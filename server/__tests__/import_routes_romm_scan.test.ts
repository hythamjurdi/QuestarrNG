import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import realFs from "fs-extra";

const { mockStorage, testConnection, scanPlatforms } = vi.hoisted(() => ({
  mockStorage: {
    getImportConfig: vi.fn(),
    getRomMConfig: vi.fn(),
    updateRomMConfig: vi.fn(),
    getPlatformMappings: vi.fn(),
    getSystemConfig: vi.fn(),
    setSystemConfig: vi.fn(),
  },
  testConnection: vi.fn(),
  scanPlatforms: vi.fn(),
}));

vi.mock("../storage.js", () => ({ storage: mockStorage }));
vi.mock("../services/index.js", () => ({
  importManager: {},
  pathMappingService: {},
  platformMappingService: {},
}));
vi.mock("../library-scanner.js", () => ({
  rescanAllEnabledRootFolders: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/RommScanService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/RommScanService.js")>();
  return {
    ...actual,
    RommApiClient: vi.fn().mockImplementation(function (this: unknown, url: string, token: string) {
      return { url, token, testConnection, scanPlatforms };
    }),
  };
});

import { importRouter } from "../routes/import.js";
import { RommApiClient } from "../services/RommScanService.js";
import { EXTRACT_TEMP_DIR_CONFIG_KEY } from "../services/extract-staging.js";
import { createImportTestApp, makeRomMConfig } from "./helpers/import-test-helpers.js";
import { DEFAULT_ROMM_CONFIG, rommConfigSchema } from "../../shared/schema.js";

const createApp = () => createImportTestApp(importRouter, true);

let stored = makeRomMConfig();

beforeEach(() => {
  vi.clearAllMocks();
  stored = makeRomMConfig({
    enabled: true,
    apiUrl: "http://romm:8080",
    apiToken: "rmm_secret",
    scanType: "update",
  });
  mockStorage.getRomMConfig.mockImplementation(async () => stored);
  mockStorage.updateRomMConfig.mockImplementation(async (_u: string, next: typeof stored) => {
    stored = next;
    return next;
  });
});

describe("RomM config storage compatibility", () => {
  it("parses a config saved before the scan/unpack fields existed, without resetting it", () => {
    const legacy = {
      enabled: true,
      libraryRoot: "/romm/roms",
      platformRoutingMode: "slug-subfolder",
      platformBindings: {},
      moveMode: "copy",
      conflictPolicy: "skip",
      singleFilePlacement: "subfolder",
      bindingMissingBehavior: "fallback",
    };
    const parsed = rommConfigSchema.parse(legacy);
    expect(parsed).toMatchObject({
      ...legacy,
      unpackRar: true,
      unpack7z: false,
      unpackZip: false,
      folderLayout: "platform",
      scanScope: "platforms",
      triggerScan: true,
      apiToken: "",
    });
  });

  it("defaults new installs to a seeding-safe transfer", () => {
    expect(DEFAULT_ROMM_CONFIG.moveMode).toBe("hardlink");
  });
});

describe("RomM token handling", () => {
  it("never returns the stored token", async () => {
    const res = await request(createApp()).get("/api/imports/romm");
    expect(res.status).toBe(200);
    expect(res.body.apiToken).toBe("********");
    expect(JSON.stringify(res.body)).not.toContain("rmm_secret");
  });

  it("keeps the stored token when the placeholder is echoed back", async () => {
    const res = await request(createApp())
      .patch("/api/imports/romm")
      .send({ apiToken: "********", triggerScan: false });
    expect(res.status).toBe(200);
    expect(stored.apiToken).toBe("rmm_secret");
    expect(stored.triggerScan).toBe(false);
    expect(res.body.apiToken).toBe("********");
  });

  it("a partial patch leaves every other field alone", async () => {
    await request(createApp()).patch("/api/imports/romm").send({ unpackRar: false });
    expect(stored).toMatchObject({
      unpackRar: false,
      apiUrl: "http://romm:8080",
      apiToken: "rmm_secret",
      scanType: "update",
      triggerScan: true,
    });
  });

  it("rejects an unusable RomM URL", async () => {
    const res = await request(createApp())
      .patch("/api/imports/romm")
      .send({ apiUrl: "ftp://romm" });
    expect(res.status).toBe(400);
    expect(stored.apiUrl).toBe("http://romm:8080");
  });
});

describe("POST /api/imports/romm/test and /romm/scan", () => {
  it("tests unsaved form values, falling back to the saved token for the placeholder", async () => {
    testConnection.mockResolvedValue({ ok: true, scanEndpoint: "http", message: "Connected" });
    const res = await request(createApp())
      .post("/api/imports/romm/test")
      .send({ apiUrl: "http://other:8080", apiToken: "********" });
    expect(res.body).toMatchObject({ ok: true });
    expect(RommApiClient).toHaveBeenCalledWith("http://other:8080", "rmm_secret");
  });

  it("scans every mapped RomM platform on demand", async () => {
    mockStorage.getPlatformMappings.mockResolvedValue([
      { rommPlatformSlug: "psx" },
      { rommPlatformSlug: "PSX" },
      { rommPlatformSlug: null },
      { rommPlatformSlug: "snes" },
    ]);
    scanPlatforms.mockResolvedValue({ ok: true, via: "http" });
    const res = await request(createApp()).post("/api/imports/romm/scan").send({});
    expect(res.status).toBe(202);
    expect(scanPlatforms).toHaveBeenCalledWith(["psx", "snes"], "update");
  });
});

describe("POST /api/imports/romm/scan with the library scope", () => {
  it("asks RomM for a whole-library scan without needing platform mappings", async () => {
    stored = { ...stored, scanScope: "library" };
    mockStorage.getPlatformMappings.mockResolvedValue([]);
    scanPlatforms.mockResolvedValue({ ok: true, via: "http" });
    const res = await request(createApp()).post("/api/imports/romm/scan").send({});
    expect(res.status).toBe(202);
    expect(scanPlatforms).toHaveBeenCalledWith([], "update");
  });
});

describe("new RomM settings", () => {
  it("saves layout, unpack and skip settings and normalizes extensions", async () => {
    const res = await request(createApp())
      .patch("/api/imports/romm")
      .send({
        folderLayout: "platform-roms",
        unpack7z: true,
        unpackZip: true,
        skipExtensions: [".NFO", " .sfv "],
        scanScope: "library",
      });
    expect(res.status).toBe(200);
    expect(stored).toMatchObject({
      folderLayout: "platform-roms",
      unpack7z: true,
      unpackZip: true,
      skipExtensions: [".nfo", ".sfv"],
      scanScope: "library",
      apiToken: "rmm_secret",
    });
  });

  it.each([{ folderLayout: "nested" }, { skipExtensions: ["nfo"] }, { scanScope: "all" }])(
    "rejects invalid value %o",
    async (body) => {
      const res = await request(createApp()).patch("/api/imports/romm").send(body);
      expect(res.status).toBe(400);
    }
  );
});

describe("extraction temp directory setting", () => {
  it("stores a writable absolute directory and clears it with an empty value", async () => {
    const dir = path.join(os.tmpdir(), `questarr-extract-tmp-${randomBytes(4).toString("hex")}`);
    try {
      const res = await request(createApp())
        .put("/api/imports/extraction")
        .send({ extractTempDir: dir });
      expect(res.status).toBe(200);
      expect(mockStorage.setSystemConfig).toHaveBeenCalledWith(EXTRACT_TEMP_DIR_CONFIG_KEY, dir);
      expect(await realFs.pathExists(dir)).toBe(true);

      await request(createApp()).put("/api/imports/extraction").send({ extractTempDir: "" });
      expect(mockStorage.setSystemConfig).toHaveBeenLastCalledWith(EXTRACT_TEMP_DIR_CONFIG_KEY, "");
    } finally {
      await realFs.remove(dir);
    }
  });

  it.each(["relative/dir", "/", "/etc"])("rejects %s", async (value) => {
    const res = await request(createApp())
      .put("/api/imports/extraction")
      .send({ extractTempDir: value });
    expect(res.status).toBe(400);
    expect(mockStorage.setSystemConfig).not.toHaveBeenCalled();
  });
});
