import { storage } from "../storage.js";
import { PathMappingService } from "./PathMappingService.js";
import { PlatformMappingService } from "./PlatformMappingService.js";
import { ArchiveService } from "./ArchiveService.js";
import { ImportManager } from "./ImportManager.js";
import { RommScanService } from "./RommScanService.js";
import { importProgress } from "./ImportProgress.js";
import { SecurityScanService } from "../security-scan.js";
import { logger } from "../logger.js";

// Instantiate services
export { importProgress };
export const pathMappingService = new PathMappingService(storage);
export const platformMappingService = new PlatformMappingService(storage);
export const archiveService = new ArchiveService();
export const securityScanService = new SecurityScanService(storage);

export const rommScanService = new RommScanService({
  getConfig: (userId) => storage.getRomMConfig(userId),
  notify: async (userId, title, message) => {
    await storage
      .addNotification({ userId, type: "warning", title, message })
      .catch((err: unknown) => logger.warn({ err }, "Could not record RomM scan notification"));
  },
});

export const importManager = new ImportManager(
  storage,
  pathMappingService,
  platformMappingService,
  archiveService,
  securityScanService,
  rommScanService,
  importProgress
);
