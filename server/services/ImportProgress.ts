import { notifyUser } from "../socket.js";

/**
 * Live state of imports that are running (or just finished), pushed to the owner's
 * browser over the socket as "importProgress" and readable from GET /api/imports/progress
 * so a page opened mid-import can show it too. Nothing here is persisted: the durable
 * outcome is the download's status and Import History.
 */

export type ImportStage =
  | "checking" // locating files, security scan
  | "verifying" // testing archive integrity (reads the whole archive)
  | "extracting"
  | "copying"
  | "finishing"
  | "done"
  | "failed";

export interface ImportProgressState {
  downloadId: string;
  gameId: string;
  title: string;
  stage: ImportStage;
  /** What is being worked on, e.g. the archive name, or the destination when done. */
  detail?: string | undefined;
  /** 0–100 when the current stage can be measured. */
  percent?: number | undefined;
  /** "Archive 2 of 3" for multi-disc releases. */
  step?: { current: number; total: number } | undefined;
  /** RomM platform folder the import goes to, when it is a RomM import. */
  rommSlug?: string | undefined;
  error?: string | undefined;
  startedAt: number;
  updatedAt: number;
}

// A finished import stays visible this long so the result can be read.
const FINISHED_TTL_MS = 2 * 60 * 1000;
// Percent updates closer together than this are coalesced (polling runs every 2s anyway).
const MIN_EMIT_INTERVAL_MS = 750;

interface Entry {
  userId: string;
  state: ImportProgressState;
  lastEmit: number;
  cleanup?: ReturnType<typeof setTimeout>;
}

export class ImportProgressTracker {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly emit: (userId: string, state: ImportProgressState) => void = (
      userId,
      state
    ) => notifyUser("importProgress", state, userId)
  ) {}

  start(
    downloadId: string,
    info: { userId: string; gameId: string; title: string; rommSlug?: string | undefined }
  ): void {
    const existing = this.entries.get(downloadId);
    if (existing?.cleanup) clearTimeout(existing.cleanup);
    const now = Date.now();
    const entry: Entry = {
      userId: info.userId,
      lastEmit: 0,
      state: {
        downloadId,
        gameId: info.gameId,
        title: info.title,
        stage: "checking",
        rommSlug: info.rommSlug,
        startedAt: now,
        updatedAt: now,
      },
    };
    this.entries.set(downloadId, entry);
    this.send(entry, true);
  }

  update(downloadId: string, patch: Partial<Omit<ImportProgressState, "downloadId">>): void {
    const entry = this.entries.get(downloadId);
    if (!entry) return;
    const stageChanged = patch.stage !== undefined && patch.stage !== entry.state.stage;
    entry.state = {
      ...entry.state,
      ...patch,
      // A new stage starts unmeasured unless the patch says otherwise.
      ...(stageChanged && patch.percent === undefined ? { percent: undefined } : {}),
      updatedAt: Date.now(),
    };
    this.send(entry, stageChanged || patch.step !== undefined);
  }

  finish(downloadId: string, outcome: { error?: string; detail?: string }): void {
    const entry = this.entries.get(downloadId);
    if (!entry) return;
    entry.state = {
      ...entry.state,
      stage: outcome.error ? "failed" : "done",
      percent: outcome.error ? entry.state.percent : 100,
      detail: outcome.detail ?? entry.state.detail,
      error: outcome.error,
      updatedAt: Date.now(),
    };
    this.send(entry, true);
    entry.cleanup = setTimeout(() => {
      if (this.entries.get(downloadId) === entry) this.entries.delete(downloadId);
    }, FINISHED_TTL_MS);
    entry.cleanup.unref?.();
  }

  isActive(downloadId: string): boolean {
    const stage = this.entries.get(downloadId)?.state.stage;
    return !!stage && stage !== "done" && stage !== "failed";
  }

  list(userId: string): ImportProgressState[] {
    return [...this.entries.values()].filter((e) => e.userId === userId).map((e) => e.state);
  }

  private send(entry: Entry, force: boolean): void {
    const now = Date.now();
    if (!force && now - entry.lastEmit < MIN_EMIT_INTERVAL_MS) return;
    entry.lastEmit = now;
    try {
      this.emit(entry.userId, entry.state);
    } catch {
      // Progress is informational; a socket problem must never affect the import.
    }
  }
}

export const importProgress = new ImportProgressTracker();
