// End-to-end RomM + RAR pipeline with the real RARLAB tools: builds genuine multi-volume
// RAR sets with `rar`, then runs them through ImportManager and ArchiveService for real.
// Skipped when `rar`/`unrar` aren't installed (CI images ship neither; the production
// Docker image ships unrar only).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { ImportManager } from "../services/ImportManager.js";
import { ArchiveService } from "../services/ArchiveService.js";
import { EXTRACT_STAGING_PREFIX } from "../services/extract-staging.js";
import { makeGame, makeImportConfig, makeRomMConfig } from "./helpers/import-test-helpers.js";
import type { ImportConfig, RomMConfig } from "../../shared/schema.js";

function hasBinary(name: string): boolean {
  try {
    execFileSync("which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const toolsAvailable = hasBinary("rar") && hasBinary("unrar");

const cleanup: string[] = [];
function tempDir(label: string): string {
  const dir = path.join(os.tmpdir(), `questarr-romm-${label}-${randomBytes(6).toString("hex")}`);
  cleanup.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of cleanup.splice(0, cleanup.length)) await fs.remove(dir);
  vi.restoreAllMocks();
});

// A payload larger than one volume so `rar -v` really splits it.
function payload(seed: string, size = 300 * 1024): Buffer {
  const out = Buffer.alloc(size);
  for (let i = 0; i < size; i++) out[i] = (seed.charCodeAt(i % seed.length) + i) & 0xff;
  return out;
}

/** Creates a multi-volume RAR of `files` named `<baseName>.rar` (rar picks the volume naming). */
async function makeRar(
  workDir: string,
  outDir: string,
  baseName: string,
  files: Record<string, Buffer>,
  oldStyleVolumes = false
): Promise<string[]> {
  const contentDir = path.join(workDir, `content-${baseName}`);
  await fs.ensureDir(contentDir);
  for (const [name, data] of Object.entries(files)) {
    await fs.ensureDir(path.dirname(path.join(contentDir, name)));
    await fs.writeFile(path.join(contentDir, name), data);
  }
  await fs.ensureDir(outDir);
  execFileSync(
    "rar",
    [
      "a",
      "-idq",
      "-ep1",
      "-r",
      "-m0",
      "-v100k",
      path.join(outDir, `${baseName}.rar`),
      `${contentDir}${path.sep}*`,
    ],
    { stdio: "ignore" }
  );
  if (oldStyleVolumes) {
    // rar 7 only writes RAR5, which always uses .partN.rar names; unrar follows the
    // classic .rar/.r00/.r01 scheme from the file names alone, so rename to it.
    const parts = (await fs.readdir(outDir))
      .filter((n) => n.startsWith(`${baseName}.part`))
      .sort((a, b) => Number(/part(\d+)/.exec(a)![1]) - Number(/part(\d+)/.exec(b)![1]));
    for (const [i, name] of parts.entries()) {
      const target = i === 0 ? `${baseName}.rar` : `${baseName}.r${String(i - 1).padStart(2, "0")}`;
      await fs.rename(path.join(outDir, name), path.join(outDir, target));
    }
  }
  return (await fs.readdir(outDir)).filter((n) => n.startsWith(baseName));
}

async function listTree(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string, rel: string): Promise<void> => {
    for (const entry of await fs.readdir(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(d, entry.name), r);
      else out.push(r);
    }
  };
  if (await fs.pathExists(dir)) await walk(dir, "");
  return out.sort();
}

async function snapshot(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const rel of await listTree(dir)) {
    const stat = await fs.stat(path.join(dir, rel));
    result[rel] = `${stat.size}:${stat.mtimeMs}`;
  }
  return result;
}

describe.skipIf(!toolsAvailable)("RomM + RAR pipeline (real rar/unrar)", () => {
  let work: string;
  let downloads: string;
  let rommRoot: string;
  let scratch: string;

  beforeEach(async () => {
    work = tempDir("work");
    downloads = tempDir("downloads");
    rommRoot = tempDir("romm");
    scratch = tempDir("scratch");
    await fs.ensureDir(rommRoot);
  });

  function setup(
    options: {
      rommOverrides?: Partial<RomMConfig>;
      importOverrides?: Partial<ImportConfig>;
      extractTempDir?: string;
      slug?: string;
    } = {}
  ) {
    const storage = {
      getGameDownload: vi.fn().mockResolvedValue({
        id: "dl-1",
        gameId: "g1",
        downloaderId: "d1",
        downloadHash: "abc",
        downloadTitle: "Some Game (USA)",
      }),
      getGame: vi
        .fn()
        .mockResolvedValue(
          makeGame({ id: "g1", userId: "u1", title: "Some Game", platforms: [7] })
        ),
      getImportConfig: vi
        .fn()
        .mockResolvedValue(
          makeImportConfig({ libraryRoot: tempDir("pc"), ...options.importOverrides })
        ),
      getRomMConfig: vi
        .fn()
        .mockResolvedValue(
          makeRomMConfig({ enabled: true, libraryRoot: rommRoot, ...options.rommOverrides })
        ),
      getPlatformMapping: vi.fn().mockResolvedValue({ rommPlatformSlug: options.slug ?? "psx" }),
      getSystemConfig: vi.fn().mockResolvedValue(options.extractTempDir ?? ""),
      getDownloader: vi.fn().mockResolvedValue(undefined),
      updateGameDownloadStatus: vi.fn().mockResolvedValue(undefined),
      updateGameStatus: vi.fn().mockResolvedValue(undefined),
      updateGame: vi.fn().mockResolvedValue(undefined),
      addNotification: vi.fn().mockResolvedValue(undefined),
    };
    const pathService = {
      translatePath: vi.fn(async (p: string) => p),
      getConfiguredRoots: vi.fn().mockResolvedValue([]),
    };
    const archiveService = new ArchiveService();
    const extractSpy = vi.spyOn(archiveService, "extract");
    const rommScan = { queueScan: vi.fn().mockResolvedValue(undefined) };
    const manager = new ImportManager(
      storage as never, // NOSONAR
      pathService as never, // NOSONAR
      {} as never, // NOSONAR
      archiveService,
      undefined,
      rommScan
    );
    return { storage, manager, extractSpy, rommScan };
  }

  it("unpacks multi-disc, multi-volume RAR sets into the RomM platform folder and leaves the download untouched", async () => {
    const release = path.join(downloads, "Some.Game.USA.PSX-GRP");
    const disc1 = payload("disc-one");
    const disc1Cue = Buffer.from('FILE "Some Game (Disc 1).bin" BINARY\n');
    const disc2 = payload("disc-two");
    // Disc 1: modern .partN.rar naming. Disc 2: classic .rar/.r00/.r01 naming.
    const set1 = await makeRar(work, release, "Some Game (Disc 1)", {
      "Some Game (Disc 1).bin": disc1,
      "Some Game (Disc 1).cue": disc1Cue,
    });
    const set2 = await makeRar(
      work,
      release,
      "Some Game (Disc 2)",
      { "Some Game (Disc 2).bin": disc2 },
      true
    );
    await fs.writeFile(path.join(release, "release.nfo"), "nfo");
    expect(set1.length).toBeGreaterThan(1);
    expect(set2.some((n) => /\.r00$/.test(n))).toBe(true);

    const before = await snapshot(release);
    const { manager, storage, rommScan, extractSpy } = setup({ extractTempDir: scratch });

    await manager.processImport("dl-1", release);

    expect(storage.updateGameDownloadStatus).not.toHaveBeenCalledWith(
      "dl-1",
      "manual_review_required",
      expect.anything()
    );
    const destDir = path.join(rommRoot, "psx", "Some Game");
    const placed = await listTree(destDir);
    expect(placed).toEqual(
      ["Some Game (Disc 1).bin", "Some Game (Disc 1).cue", "Some Game (Disc 2).bin"].sort()
    );
    // release.nfo is release clutter: skipped by default, and left in the download.
    expect(await fs.pathExists(path.join(release, "release.nfo"))).toBe(true);
    expect(await fs.readFile(path.join(destDir, "Some Game (Disc 1).bin"))).toEqual(disc1);
    expect(await fs.readFile(path.join(destDir, "Some Game (Disc 2).bin"))).toEqual(disc2);
    // One extraction per archive set, each from its first volume, read in place.
    expect(extractSpy).toHaveBeenCalledTimes(2);
    for (const call of extractSpy.mock.calls) {
      expect(path.dirname(call[0])).toBe(release);
      expect(call[3]).toEqual({ stagingRoot: scratch });
    }

    // Seeding: every original volume is still there, byte-for-byte unchanged.
    expect(await snapshot(release)).toEqual(before);
    // Temp folders are gone: nothing in the scratch dir, no staging dir in the library.
    expect(await fs.readdir(scratch)).toEqual([]);
    expect((await fs.readdir(destDir)).some((n) => n.startsWith(EXTRACT_STAGING_PREFIX))).toBe(
      false
    );
    // RomM is asked to scan the platform that received files.
    expect(rommScan.queueScan).toHaveBeenCalledWith("u1", "psx");
  });

  it("follows the <platform>/roms layout and drops clutter that came out of the archive", async () => {
    const release = path.join(downloads, "Layout.Release");
    const iso = payload("ps2-iso");
    await makeRar(work, release, "game", {
      "Some Game.iso": iso,
      "info.nfo": Buffer.from("scene nfo"),
      "file_id.diz": Buffer.from("diz"),
    });
    // Mirrors an existing RomM library laid out as <root>/<platform>/roms/.
    await fs.ensureDir(path.join(rommRoot, "ps2", "roms"));
    await fs.writeFile(path.join(rommRoot, "ps2", "roms", "Other Game.iso"), "existing");

    const { manager, rommScan } = setup({
      slug: "ps2",
      rommOverrides: { folderLayout: "platform-roms" },
    });
    await manager.processImport("dl-1", release);

    expect(await listTree(path.join(rommRoot, "ps2"))).toEqual([
      "roms/Other Game.iso",
      "roms/Some Game/Some Game.iso",
    ]);
    expect(
      await fs.readFile(path.join(rommRoot, "ps2", "roms", "Some Game", "Some Game.iso"))
    ).toEqual(iso);
    expect(rommScan.queueScan).toHaveBeenCalledWith("u1", "ps2");
  });

  it("routes a scene PS5 release to <root>/ps5/roms/<game> via the release title", async () => {
    const release = path.join(downloads, "Ghost.of.Yotei.incl.DLC.PS5-DUPLEX");
    const data = payload("ps5-pkg");
    await makeRar(work, release, "dup-goy", { "Ghost.of.Yotei.PS5.pkg": data });
    await fs.writeFile(path.join(release, "dup-goy.nfo"), "nfo");

    const { manager, storage, rommScan } = setup({
      rommOverrides: { folderLayout: "platform-roms" },
    });
    storage.getGameDownload.mockResolvedValue({
      id: "dl-1",
      gameId: "g1",
      downloaderId: "d1",
      downloadHash: "abc",
      downloadTitle: "Ghost of Yotei incl DLC PS5-DUPLEX",
    });
    storage.getGame.mockResolvedValue(
      makeGame({ id: "g1", userId: "u1", title: "Ghost of Yotei", platforms: [] })
    );
    // Only IGDB 167 (PlayStation 5) is mapped, so the slug must come from the "PS5" tag.
    storage.getPlatformMapping.mockImplementation(async (id: number) =>
      id === 167 ? { rommPlatformSlug: "ps5" } : undefined
    );

    await manager.processImport("dl-1", release);

    expect(await listTree(path.join(rommRoot, "ps5"))).toEqual([
      "roms/Ghost of Yotei/Ghost.of.Yotei.PS5.pkg",
    ]);
    expect(rommScan.queueScan).toHaveBeenCalledWith("u1", "ps5");
  });

  it("copies every file when the skip list is empty", async () => {
    const release = path.join(downloads, "Keep.All");
    await fs.ensureDir(release);
    await fs.writeFile(path.join(release, "Some Game.gba"), payload("gba", 2048));
    await fs.writeFile(path.join(release, "notes.txt"), "keep me");

    const { manager } = setup({ slug: "gba", rommOverrides: { skipExtensions: [] } });
    await manager.processImport("dl-1", release);

    expect(await listTree(path.join(rommRoot, "gba", "Some Game"))).toEqual([
      "Some Game.gba",
      "notes.txt",
    ]);
  });

  it.skipIf(!hasBinary("7z"))("unpacks 7z and zip only when those switches are on", async () => {
    const release = path.join(downloads, "Seven.Zip");
    const contentDir = path.join(work, "sz");
    await fs.ensureDir(contentDir);
    await fs.writeFile(path.join(contentDir, "Some Game.bin"), payload("bin"));
    await fs.ensureDir(release);
    execFileSync(
      "7z",
      ["a", "-bd", "-y", path.join(release, "game.7z"), path.join(contentDir, "Some Game.bin")],
      {
        stdio: "ignore",
      }
    );

    const off = setup();
    await off.manager.processImport("dl-1", release);
    expect(await listTree(path.join(rommRoot, "psx", "Some Game"))).toEqual(["game.7z"]);

    await fs.remove(path.join(rommRoot, "psx"));
    const on = setup({ rommOverrides: { unpack7z: true } });
    await on.manager.processImport("dl-1", release);
    expect(await listTree(path.join(rommRoot, "psx", "Some Game"))).toEqual(["Some Game.bin"]);
    expect(await fs.pathExists(path.join(release, "game.7z"))).toBe(true);
  });

  it("leaves zip ROMs packed for RomM (RAR-only unpacking)", async () => {
    const release = path.join(downloads, "Some.Game.NES");
    await fs.ensureDir(release);
    await fs.writeFile(path.join(release, "Some Game (USA).zip"), payload("zip-rom", 4096));

    const { manager, extractSpy, rommScan } = setup({ slug: "nes" });
    await manager.processImport("dl-1", release);

    expect(extractSpy).not.toHaveBeenCalled();
    expect(await listTree(path.join(rommRoot, "nes", "Some Game"))).toEqual([
      "Some Game (USA).zip",
    ]);
    expect(await fs.pathExists(path.join(release, "Some Game (USA).zip"))).toBe(true);
    expect(rommScan.queueScan).toHaveBeenCalledWith("u1", "nes");
  });

  it("copies the RAR set raw when RAR unpacking is turned off", async () => {
    const release = path.join(downloads, "Raw.Release");
    const volumes = await makeRar(work, release, "game", { "game.iso": payload("iso") });

    const { manager, extractSpy } = setup({ rommOverrides: { unpackRar: false } });
    await manager.processImport("dl-1", release);

    expect(extractSpy).not.toHaveBeenCalled();
    expect(await listTree(path.join(rommRoot, "psx", "Some Game"))).toEqual(volumes.sort());
  });

  it("never deletes the download with a configured move while auto-delete is off", async () => {
    const release = path.join(downloads, "Move.Release");
    await makeRar(work, release, "game", { "game.iso": payload("iso") });
    const before = await snapshot(release);

    const { manager } = setup({ rommOverrides: { moveMode: "move" } });
    await manager.processImport("dl-1", release);

    expect(await listTree(path.join(rommRoot, "psx", "Some Game"))).toEqual(["game.iso"]);
    expect(await snapshot(release)).toEqual(before);
  });

  it("moves (consuming the download) only when auto-delete is enabled", async () => {
    const release = path.join(downloads, "Move.Allowed");
    await makeRar(work, release, "game", { "game.iso": payload("iso") });

    const { manager } = setup({
      rommOverrides: { moveMode: "move" },
      importOverrides: { autoDeleteAfterImport: true },
    });
    await manager.processImport("dl-1", release);

    expect(await listTree(path.join(rommRoot, "psx", "Some Game"))).toEqual(["game.iso"]);
    expect(await fs.pathExists(release)).toBe(false);
  });
});

describe.skipIf(!toolsAvailable)("ArchiveService extraction temp directory (real unrar)", () => {
  it("extracts through a scratch dir on request and always removes it", async () => {
    const work = tempDir("as-work");
    const src = tempDir("as-src");
    const dest = tempDir("as-dest");
    const scratch = tempDir("as-scratch");
    const data = payload("rom");
    await makeRar(work, src, "set", { "nested/rom.bin": data });

    const service = new ArchiveService();
    await service.extract(path.join(src, "set.part1.rar"), dest, undefined, {
      stagingRoot: scratch,
    });

    expect(await fs.readFile(path.join(dest, "nested", "rom.bin"))).toEqual(data);
    expect(await fs.readdir(scratch)).toEqual([]);
    expect(await fs.readdir(dest)).toEqual(["nested"]);
  });

  it("cleans the scratch dir after a failed extraction too", async () => {
    const work = tempDir("as-work2");
    const src = tempDir("as-src2");
    const dest = tempDir("as-dest2");
    const scratch = tempDir("as-scratch2");
    const volumes = await makeRar(work, src, "broken", { "rom.bin": payload("rom") });
    // Remove the last volume: the set is incomplete and cannot extract.
    await fs.remove(path.join(src, volumes.sort().at(-1)!));

    const service = new ArchiveService();
    await expect(
      service.extract(path.join(src, "broken.part1.rar"), dest, undefined, {
        stagingRoot: scratch,
      })
    ).rejects.toThrow();
    expect(await fs.readdir(scratch)).toEqual([]);
    expect(await listTree(dest)).toEqual([]);
  });
});
