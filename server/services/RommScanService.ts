import { io as socketIoClient, type Socket } from "socket.io-client";
import type { RomMConfig, RomMScanType } from "../../shared/schema.js";
import { logger } from "../logger.js";
import { isSafeUrl, safeFetch } from "../ssrf.js";

/**
 * Asks a RomM server to scan the platforms Questarr just imported into, so new ROMs show
 * up without a manual "Scan library" in RomM.
 *
 * Primary path: `POST /api/tasks/scan` with `platform_fs_slugs` (RomM 4.x and later). The
 * slugs are exactly the RomM platform slugs Questarr already routes imports by, so no id
 * lookup is needed and a platform folder RomM has never seen is still picked up.
 *
 * Fallback, for a RomM without that route (it answers 404/405): resolve platform ids with
 * `GET /api/platforms` and emit the `scan` event on RomM's socket.io endpoint, the way
 * RomM's own UI starts a scan.
 *
 * Auth is a RomM Client API Token (`rmm_…`) sent as a Bearer token; it needs the
 * `tasks.run` scope, plus `platforms.read` for the fallback.
 */

const REQUEST_TIMEOUT_MS = 15_000;
const SOCKET_CONNECT_TIMEOUT_MS = 10_000;
// After emitting `scan`, RomM answers `scan:done_ko` right away when it refuses the request
// (bad scope, no worker, scan already running). Waiting this long for that answer before
// disconnecting lets a refusal be reported; silence means the scan was queued.
const SOCKET_REFUSAL_WINDOW_MS = 3_000;
// A scan already running in RomM refuses a second one (HTTP 409). Retry after these delays.
const BUSY_RETRY_DELAYS_MS = [60_000, 120_000, 300_000, 600_000];

export type RommScanOutcome =
  | { ok: true; via: "http" | "socket"; taskId?: string }
  | { ok: false; busy: boolean; message: string };

export interface RommConnectionTestResult {
  ok: boolean;
  version?: string | undefined;
  scanEndpoint: "http" | "socket" | "unknown";
  message: string;
}

export interface RommApiTransport {
  fetch(url: string, init: RequestInit & { requireHttps?: boolean }): Promise<Response>;
  connectSocket(baseUrl: string, token: string): Socket;
  isSafeUrl(url: string): Promise<boolean>;
}

const defaultTransport: RommApiTransport = {
  fetch: (url, init) =>
    safeFetch(url, { ...init, allowPrivate: true, timeoutMs: REQUEST_TIMEOUT_MS }),
  connectSocket: (baseUrl, token) =>
    socketIoClient(baseUrl, {
      path: "/ws/socket.io",
      auth: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
      reconnection: false,
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
      transports: ["websocket", "polling"],
    }),
  isSafeUrl: (url) => isSafeUrl(url, { allowPrivate: true }),
};

export function normalizeRommBaseUrl(raw: string): string {
  let value = raw.trim();
  if (!value) throw new Error("RomM URL is not configured");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    if (!/^https?:\/\//i.test(value)) throw new Error("RomM URL must use http or https");
  } else {
    value = `http://${value}`;
  }
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("RomM URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("Put credentials in the API token field, not the RomM URL");
  }
  // Keep a sub-path (RomM behind a reverse proxy at /romm), drop query/hash and the
  // trailing slash, and strip a pasted "/api" so both "http://romm" and
  // "http://romm/api" work.
  let pathname = url.pathname.replace(/\/+$/, "");
  if (/\/api$/i.test(pathname)) pathname = pathname.slice(0, -"/api".length);
  return `${url.protocol}//${url.host}${pathname}`;
}

export class RommApiClient {
  private readonly baseUrl: string;

  constructor(
    apiUrl: string,
    private readonly token: string,
    private readonly transport: RommApiTransport = defaultTransport
  ) {
    this.baseUrl = normalizeRommBaseUrl(apiUrl);
    if (!token.trim()) throw new Error("RomM API token is not configured");
  }

  private async request(method: string, apiPath: string, body?: unknown): Promise<Response> {
    if (!(await this.transport.isSafeUrl(this.baseUrl))) {
      throw new Error("RomM URL is not allowed by the server's network policy");
    }
    return this.transport.fetch(`${this.baseUrl}${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        "User-Agent": "QuestarrNG",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      // The token must never be replayed over plaintext by a redirect off an HTTPS RomM.
      requireHttps: this.baseUrl.startsWith("https://"),
      redirect: "manual",
    });
  }

  private static async errorDetail(res: Response): Promise<string> {
    const text = await res.text().catch(() => "");
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {
      // not JSON
    }
    return text.slice(0, 200) || res.statusText || `HTTP ${res.status}`;
  }

  async getVersion(): Promise<string | undefined> {
    const res = await this.request("GET", "/api/heartbeat");
    if (!res.ok) throw new Error(`RomM heartbeat failed: HTTP ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as { SYSTEM?: { VERSION?: unknown } };
    return typeof data.SYSTEM?.VERSION === "string" ? data.SYSTEM.VERSION : undefined;
  }

  async testConnection(): Promise<RommConnectionTestResult> {
    let version: string | undefined;
    try {
      version = await this.getVersion();
    } catch (err) {
      return {
        ok: false,
        scanEndpoint: "unknown",
        message: `Could not reach RomM: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // tasks.run is the scope a scan needs, and /api/tasks/status is a harmless GET that
    // RomM gates on it — so this checks the token and its scope without starting anything.
    const statusRes = await this.request("GET", "/api/tasks/status");
    if (statusRes.status === 401) {
      return {
        ok: false,
        version,
        scanEndpoint: "unknown",
        message: "RomM rejected the API token",
      };
    }
    if (statusRes.status === 403) {
      return {
        ok: false,
        version,
        scanEndpoint: "unknown",
        message: 'The API token is missing the "tasks.run" scope RomM requires to start scans',
      };
    }

    // A probe request can't tell whether POST /api/tasks/scan exists (a GET there is
    // captured by GET /api/tasks/{task_id}), so read RomM's own OpenAPI document instead.
    const scanEndpoint = await this.detectScanEndpoint();
    const label = `Connected to RomM${version ? ` ${version}` : ""}`;
    return {
      ok: true,
      version,
      scanEndpoint,
      message:
        scanEndpoint === "socket"
          ? `${label}. This version has no scan API, so scans are started over its websocket (the token also needs "platforms.read").`
          : label,
    };
  }

  private async detectScanEndpoint(): Promise<"http" | "socket" | "unknown"> {
    try {
      const res = await this.request("GET", "/openapi.json");
      if (!res.ok) return "unknown";
      const doc = (await res.json()) as { paths?: Record<string, Record<string, unknown>> };
      if (!doc.paths) return "unknown";
      return doc.paths["/api/tasks/scan"]?.post ? "http" : "socket";
    } catch {
      return "unknown";
    }
  }

  async scanPlatforms(slugs: string[], scanType: RomMScanType): Promise<RommScanOutcome> {
    const res = await this.request("POST", "/api/tasks/scan", {
      type: scanType,
      platform_fs_slugs: slugs,
    });
    if (res.status === 202 || res.ok) {
      const data = (await res.json().catch(() => ({}))) as { task_id?: unknown; id?: unknown };
      const taskId = typeof data.task_id === "string" ? data.task_id : undefined;
      return { ok: true, via: "http", ...(taskId ? { taskId } : {}) };
    }
    if (res.status === 404 || res.status === 405) {
      return this.scanViaSocket(slugs, scanType);
    }
    const detail = await RommApiClient.errorDetail(res);
    if (res.status === 409) return { ok: false, busy: true, message: detail };
    if (res.status === 401)
      return { ok: false, busy: false, message: "RomM rejected the API token" };
    if (res.status === 403) {
      return {
        ok: false,
        busy: false,
        message: 'The RomM API token is missing the "tasks.run" scope',
      };
    }
    // 503: no scan worker listening yet (RomM still starting) — worth retrying.
    return { ok: false, busy: res.status === 503, message: `HTTP ${res.status}: ${detail}` };
  }

  private async resolvePlatformIds(slugs: string[]): Promise<{ ids: number[]; missing: string[] }> {
    const res = await this.request("GET", "/api/platforms");
    if (!res.ok) {
      throw new Error(
        `Could not list RomM platforms (HTTP ${res.status}); the token needs "platforms.read"`
      );
    }
    const platforms = (await res.json()) as Array<{ id?: unknown; fs_slug?: unknown }>;
    const bySlug = new Map<string, number>();
    for (const p of Array.isArray(platforms) ? platforms : []) {
      if (typeof p.id === "number" && typeof p.fs_slug === "string") {
        bySlug.set(p.fs_slug.toLowerCase(), p.id);
      }
    }
    const ids: number[] = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      const id = bySlug.get(slug.toLowerCase());
      if (id === undefined) missing.push(slug);
      else ids.push(id);
    }
    return { ids, missing };
  }

  private emitScan(options: Record<string, unknown>): Promise<RommScanOutcome> {
    return new Promise((resolve) => {
      const socket = this.transport.connectSocket(this.baseUrl, this.token);
      let settled = false;
      const finish = (outcome: RommScanOutcome): void => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        socket.removeAllListeners();
        socket.disconnect();
        resolve(outcome);
      };
      const connectTimer = setTimeout(
        () =>
          finish({ ok: false, busy: false, message: "Timed out connecting to RomM's websocket" }),
        SOCKET_CONNECT_TIMEOUT_MS
      );
      socket.on("connect_error", (err: Error) =>
        finish({ ok: false, busy: false, message: `RomM websocket error: ${err.message}` })
      );
      socket.on("scan:done_ko", (message: unknown) => {
        const text = typeof message === "string" ? message : "RomM refused the scan";
        finish({ ok: false, busy: /already|in flight|running/i.test(text), message: text });
      });
      socket.on("connect", () => {
        clearTimeout(connectTimer);
        socket.emit("scan", options);
        setTimeout(() => finish({ ok: true, via: "socket" }), SOCKET_REFUSAL_WINDOW_MS);
      });
    });
  }

  private async scanViaSocket(slugs: string[], scanType: RomMScanType): Promise<RommScanOutcome> {
    if (!(await this.transport.isSafeUrl(this.baseUrl))) {
      return { ok: false, busy: false, message: "RomM URL is not allowed by the network policy" };
    }
    // No slugs means the whole library, which RomM's socket takes as an empty list.
    if (slugs.length === 0) return this.emitScan({ platforms: [], type: scanType });
    let resolved: { ids: number[]; missing: string[] };
    try {
      resolved = await this.resolvePlatformIds(slugs);
    } catch (err) {
      return { ok: false, busy: false, message: err instanceof Error ? err.message : String(err) };
    }
    if (resolved.ids.length > 0) {
      const outcome = await this.emitScan({ platforms: resolved.ids, type: scanType });
      if (!outcome.ok || resolved.missing.length === 0) return outcome;
    }
    // A platform folder RomM has never indexed has no id yet; a new-platforms scan finds it.
    return this.emitScan({ platforms: [], type: "new_platforms" });
  }
}

interface PendingScan {
  slugs: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  busyAttempts: number;
}

export interface RommScanServiceDeps {
  getConfig(userId: string): Promise<RomMConfig>;
  notify?(userId: string, title: string, message: string): Promise<void>;
  createClient?(config: RomMConfig): RommApiClient;
  setTimer?(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimer?(timer: ReturnType<typeof setTimeout>): void;
}

/**
 * Collects RomM platforms touched by imports and sends one scan per debounce window, so a
 * batch of twenty ROMs finishing together starts one RomM scan rather than twenty (RomM
 * refuses a second library scan while one is running anyway).
 *
 * Never throws into the caller: an import has already succeeded by the time a scan is
 * queued, and a RomM that is down or misconfigured must not turn it into a failure.
 */
export class RommScanService {
  private readonly pending = new Map<string, PendingScan>();
  private readonly inFlight = new Set<string>();
  private readonly setTimer: NonNullable<RommScanServiceDeps["setTimer"]>;
  private readonly clearTimer: NonNullable<RommScanServiceDeps["clearTimer"]>;

  constructor(private readonly deps: RommScanServiceDeps) {
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms).unref());
    this.clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t));
  }

  async queueScan(userId: string, slug: string): Promise<void> {
    try {
      const config = await this.deps.getConfig(userId);
      if (!config.enabled || !config.triggerScan || !config.apiUrl || !config.apiToken) {
        logger.debug({ slug }, "[RommScan] Scan trigger not configured, skipping");
        return;
      }
      const entry = this.pending.get(userId) ?? { slugs: new Set(), timer: null, busyAttempts: 0 };
      entry.slugs.add(slug.toLowerCase());
      this.pending.set(userId, entry);
      // A retry is already waiting; the new slug rides along with it.
      if (entry.busyAttempts > 0 && entry.timer) return;
      if (entry.timer) this.clearTimer(entry.timer);
      entry.timer = this.setTimer(() => void this.flush(userId), config.scanDebounceSeconds * 1000);
    } catch (err) {
      logger.warn({ err, slug }, "[RommScan] Could not queue RomM scan");
    }
  }

  /** Sends the pending scan for a user now. Exposed for tests and a manual "scan now". */
  async flush(userId: string): Promise<RommScanOutcome | null> {
    const entry = this.pending.get(userId);
    if (!entry || entry.slugs.size === 0) return null;
    if (this.inFlight.has(userId)) {
      // A request is on the wire; check back shortly so slugs added meanwhile aren't lost.
      entry.timer = this.setTimer(() => void this.flush(userId), 5_000);
      return null;
    }
    entry.timer = null;
    const slugs = [...entry.slugs];
    entry.slugs.clear();
    this.inFlight.add(userId);

    let outcome: RommScanOutcome;
    try {
      const config = await this.deps.getConfig(userId);
      const client = this.deps.createClient
        ? this.deps.createClient(config)
        : new RommApiClient(config.apiUrl, config.apiToken);
      // "library" scope: an empty platform list asks RomM to scan every platform.
      outcome = await client.scanPlatforms(
        config.scanScope === "library" ? [] : slugs,
        config.scanType
      );
    } catch (err) {
      outcome = {
        ok: false,
        busy: false,
        message: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.inFlight.delete(userId);
    }

    if (outcome.ok) {
      logger.info(
        { slugs, via: outcome.via, taskId: outcome.ok ? outcome.taskId : undefined },
        "[RommScan] RomM scan requested"
      );
      entry.busyAttempts = 0;
      if (entry.slugs.size === 0) this.pending.delete(userId);
      return outcome;
    }

    if (outcome.busy && entry.busyAttempts < BUSY_RETRY_DELAYS_MS.length) {
      const delay = BUSY_RETRY_DELAYS_MS[entry.busyAttempts]!;
      entry.busyAttempts++;
      for (const slug of slugs) entry.slugs.add(slug);
      if (entry.timer) this.clearTimer(entry.timer);
      entry.timer = this.setTimer(() => void this.flush(userId), delay);
      logger.info(
        { slugs, delayMs: delay, attempt: entry.busyAttempts, reason: outcome.message },
        "[RommScan] RomM is busy, retrying scan later"
      );
      return outcome;
    }

    entry.busyAttempts = 0;
    if (entry.slugs.size === 0) this.pending.delete(userId);
    logger.warn({ slugs, reason: outcome.message }, "[RommScan] RomM scan request failed");
    await this.deps
      .notify?.(
        userId,
        "RomM scan not started",
        `Imported files for ${slugs.join(", ")} are in RomM's library folder, but asking RomM to scan failed: ${outcome.message}. Run a scan from RomM, or check Settings → Import → RomM.`
      )
      .catch(() => undefined);
    return outcome;
  }
}
