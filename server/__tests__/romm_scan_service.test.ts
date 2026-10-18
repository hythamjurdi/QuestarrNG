// RommApiClient / RommScanService against a local fake RomM: a real HTTP server for the
// REST routes and a real socket.io server at /ws/socket.io for the fallback path.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Server as SocketIOServer } from "socket.io";
import { io as socketIoClient } from "socket.io-client";
import {
  RommApiClient,
  RommScanService,
  normalizeRommBaseUrl,
  type RommApiTransport,
} from "../services/RommScanService.js";
import { makeRomMConfig } from "./helpers/import-test-helpers.js";

const TOKEN = "rmm_test_token";

interface FakeRomm {
  url: string;
  scanBodies: unknown[];
  socketScans: Array<{ options: unknown; token: unknown }>;
  // What POST /api/tasks/scan answers, in order (last one repeats).
  scanResponses: number[];
  hasScanRoute: boolean;
  close(): Promise<void>;
}

async function startFakeRomm(): Promise<FakeRomm> {
  const state = {
    scanBodies: [] as unknown[],
    socketScans: [] as Array<{ options: unknown; token: unknown }>,
    scanResponses: [202],
    hasScanRoute: true,
  };
  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const authed = req.headers.authorization === `Bearer ${TOKEN}`;
    let raw = "";
    req.on("data", (c: Buffer) => (raw += c.toString()));
    req.on("end", () => {
      if (req.url === "/api/heartbeat") return send(200, { SYSTEM: { VERSION: "4.9.2" } });
      if (req.url === "/openapi.json") {
        return send(200, {
          paths: state.hasScanRoute ? { "/api/tasks/scan": { post: {} } } : {},
        });
      }
      if (!authed) return send(401, { detail: "Invalid token" });
      if (req.url === "/api/tasks/status" && req.method === "GET") return send(200, []);
      if (req.url === "/api/platforms" && req.method === "GET") {
        return send(200, [
          { id: 3, fs_slug: "psx" },
          { id: 9, fs_slug: "snes" },
        ]);
      }
      if (req.url === "/api/tasks/scan" && req.method === "POST") {
        if (!state.hasScanRoute) return send(405, { detail: "Method Not Allowed" });
        state.scanBodies.push(JSON.parse(raw || "{}"));
        const status =
          state.scanResponses.length > 1 ? state.scanResponses.shift()! : state.scanResponses[0]!;
        if (status === 409) return send(409, { detail: "A library scan is already running" });
        return send(status, { task_id: "job-123", status: "queued" });
      }
      return send(404, { detail: "Not Found" });
    });
  });
  const ioServer = new SocketIOServer(server, { path: "/ws/socket.io" });
  ioServer.on("connection", (socket) => {
    socket.on("scan", (options: unknown) => {
      state.socketScans.push({ options, token: socket.handshake.auth?.token });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    get scanBodies() {
      return state.scanBodies;
    },
    get socketScans() {
      return state.socketScans;
    },
    get scanResponses() {
      return state.scanResponses;
    },
    set scanResponses(v: number[]) {
      state.scanResponses = v;
    },
    get hasScanRoute() {
      return state.hasScanRoute;
    },
    set hasScanRoute(v: boolean) {
      state.hasScanRoute = v;
    },
    close: async () => {
      ioServer.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// The production transport routes through safeFetch's SSRF policy, which (rightly) has its
// own tests; here the fake RomM lives on loopback, so plain fetch stands in.
const testTransport: RommApiTransport = {
  fetch: (url, init) => {
    const { requireHttps: _ignored, ...rest } = init;
    return fetch(url, rest);
  },
  connectSocket: (baseUrl, token) =>
    socketIoClient(baseUrl, {
      path: "/ws/socket.io",
      auth: { token },
      reconnection: false,
      transports: ["websocket"],
    }),
  isSafeUrl: async () => true,
};

describe("normalizeRommBaseUrl", () => {
  it.each([
    ["romm:8080", "http://romm:8080"],
    ["http://romm:8080/", "http://romm:8080"],
    ["https://romm.example.com/api", "https://romm.example.com"],
    ["https://example.com/romm/api/?x=1", "https://example.com/romm"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeRommBaseUrl(input)).toBe(expected);
  });

  it("rejects credentials in the URL and non-http schemes", () => {
    expect(() => normalizeRommBaseUrl("http://user:pw@romm")).toThrow(/API token/);
    expect(() => normalizeRommBaseUrl("ftp://romm")).toThrow(/http/);
    expect(() => normalizeRommBaseUrl("  ")).toThrow(/not configured/);
  });
});

describe("RommApiClient against a fake RomM", () => {
  let romm: FakeRomm;

  beforeEach(async () => {
    romm = await startFakeRomm();
  });
  afterEach(async () => {
    await romm.close();
  });

  it("starts a platform scan over POST /api/tasks/scan with fs slugs", async () => {
    const client = new RommApiClient(romm.url, TOKEN, testTransport);
    const outcome = await client.scanPlatforms(["psx", "snes"], "quick");

    expect(outcome).toEqual({ ok: true, via: "http", taskId: "job-123" });
    expect(romm.scanBodies).toEqual([{ type: "quick", platform_fs_slugs: ["psx", "snes"] }]);
  });

  it("reports a scan already running as busy", async () => {
    romm.scanResponses = [409];
    const outcome = await new RommApiClient(romm.url, TOKEN, testTransport).scanPlatforms(
      ["psx"],
      "quick"
    );
    expect(outcome).toMatchObject({ ok: false, busy: true });
  });

  it("reports a rejected token without retrying", async () => {
    const outcome = await new RommApiClient(romm.url, "rmm_wrong", testTransport).scanPlatforms(
      ["psx"],
      "quick"
    );
    expect(outcome).toEqual({ ok: false, busy: false, message: "RomM rejected the API token" });
  });

  it("falls back to the socket.io scan event on a RomM without the scan route", async () => {
    romm.hasScanRoute = false;
    const outcome = await new RommApiClient(romm.url, TOKEN, testTransport).scanPlatforms(
      ["psx", "snes"],
      "quick"
    );

    expect(outcome).toEqual({ ok: true, via: "socket" });
    expect(romm.socketScans).toEqual([
      { options: { platforms: [3, 9], type: "quick" }, token: TOKEN },
    ]);
  }, 15_000);

  it("scans the whole library over the socket when given no platforms", async () => {
    romm.hasScanRoute = false;
    await new RommApiClient(romm.url, TOKEN, testTransport).scanPlatforms([], "quick");
    expect(romm.socketScans.map((s) => s.options)).toEqual([{ platforms: [], type: "quick" }]);
  }, 15_000);

  it("adds a new-platforms scan over the socket for a platform RomM has not indexed yet", async () => {
    romm.hasScanRoute = false;
    await new RommApiClient(romm.url, TOKEN, testTransport).scanPlatforms(
      ["psx", "gamecube"],
      "quick"
    );
    expect(romm.socketScans.map((s) => s.options)).toEqual([
      { platforms: [3], type: "quick" },
      { platforms: [], type: "new_platforms" },
    ]);
  }, 20_000);

  it("tests the connection, token scope and scan endpoint", async () => {
    const ok = await new RommApiClient(romm.url, TOKEN, testTransport).testConnection();
    expect(ok).toMatchObject({ ok: true, version: "4.9.2", scanEndpoint: "http" });

    romm.hasScanRoute = false;
    const legacy = await new RommApiClient(romm.url, TOKEN, testTransport).testConnection();
    expect(legacy).toMatchObject({ ok: true, scanEndpoint: "socket" });

    const bad = await new RommApiClient(romm.url, "rmm_wrong", testTransport).testConnection();
    expect(bad).toMatchObject({ ok: false, message: "RomM rejected the API token" });
  });

  it("reports an unreachable RomM", async () => {
    const result = await new RommApiClient(
      "http://127.0.0.1:1",
      TOKEN,
      testTransport
    ).testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Could not reach RomM/);
  });
});

describe("RommScanService batching and retries", () => {
  let romm: FakeRomm;
  // Timers are captured rather than faked so real network I/O still runs.
  let timers: Array<{ fn: () => void; ms: number }>;

  beforeEach(async () => {
    romm = await startFakeRomm();
    timers = [];
  });
  afterEach(async () => {
    await romm.close();
  });

  function makeService(overrides: Parameters<typeof makeRomMConfig>[0] = {}) {
    const config = makeRomMConfig({
      enabled: true,
      apiUrl: romm.url,
      apiToken: TOKEN,
      scanDebounceSeconds: 30,
      ...overrides,
    });
    const notify = vi.fn().mockResolvedValue(undefined);
    const service = new RommScanService({
      getConfig: async () => config,
      notify,
      createClient: (c) => new RommApiClient(c.apiUrl, c.apiToken, testTransport),
      setTimer: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });
    return { service, notify };
  }

  it("collapses imports in one window into a single scan of every touched platform", async () => {
    const { service } = makeService();
    await service.queueScan("u1", "psx");
    await service.queueScan("u1", "SNES");
    await service.queueScan("u1", "psx");

    expect(timers.at(-1)?.ms).toBe(30_000);
    expect(romm.scanBodies).toEqual([]);
    await service.flush("u1");
    expect(romm.scanBodies).toEqual([{ type: "quick", platform_fs_slugs: ["psx", "snes"] }]);
  });

  it("retries later while RomM is busy, carrying new slugs along", async () => {
    romm.scanResponses = [409, 202];
    const { service } = makeService();
    await service.queueScan("u1", "psx");
    const first = await service.flush("u1");
    expect(first).toMatchObject({ ok: false, busy: true });
    expect(timers.at(-1)?.ms).toBe(60_000);

    await service.queueScan("u1", "snes");
    const second = await service.flush("u1");
    expect(second).toMatchObject({ ok: true });
    expect(romm.scanBodies.at(-1)).toEqual({
      type: "quick",
      platform_fs_slugs: ["psx", "snes"],
    });
  });

  it("notifies once when RomM refuses for good, and never throws into the import", async () => {
    const { service, notify } = makeService({ apiToken: "rmm_wrong" });
    await service.queueScan("u1", "psx");
    const outcome = await service.flush("u1");
    expect(outcome).toMatchObject({ ok: false, busy: false });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]![2]).toMatch(/psx/);
  });

  it("scans the whole library when the scope is set to library", async () => {
    const { service } = makeService({ scanScope: "library", scanType: "complete" });
    await service.queueScan("u1", "psx");
    await service.flush("u1");
    expect(romm.scanBodies).toEqual([{ type: "complete", platform_fs_slugs: [] }]);
  });

  it("does nothing when scanning is off or the API isn't configured", async () => {
    for (const overrides of [{ triggerScan: false }, { apiToken: "" }, { enabled: false }]) {
      const { service } = makeService(overrides);
      await service.queueScan("u1", "psx");
    }
    expect(timers).toEqual([]);
  });
});
