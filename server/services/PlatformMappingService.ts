import { IStorage } from "../storage.js";
import { InsertPlatformMapping, PlatformMapping } from "../../shared/schema.js";

const DEFAULT_MAPPINGS: {
  igdbPlatformId: number;
  sourcePlatformName: string;
  rommPlatformSlug: string;
}[] = [
  { igdbPlatformId: 18, sourcePlatformName: "nes", rommPlatformSlug: "nes" },
  { igdbPlatformId: 19, sourcePlatformName: "snes", rommPlatformSlug: "snes" },
  { igdbPlatformId: 4, sourcePlatformName: "n64", rommPlatformSlug: "n64" },
  { igdbPlatformId: 21, sourcePlatformName: "ngc", rommPlatformSlug: "ngc" },
  { igdbPlatformId: 5, sourcePlatformName: "wii", rommPlatformSlug: "wii" },
  { igdbPlatformId: 41, sourcePlatformName: "wiiu", rommPlatformSlug: "wiiu" },
  { igdbPlatformId: 33, sourcePlatformName: "gb", rommPlatformSlug: "gb" },
  { igdbPlatformId: 22, sourcePlatformName: "gbc", rommPlatformSlug: "gbc" },
  { igdbPlatformId: 24, sourcePlatformName: "gba", rommPlatformSlug: "gba" },
  { igdbPlatformId: 20, sourcePlatformName: "nds", rommPlatformSlug: "nds" },
  { igdbPlatformId: 37, sourcePlatformName: "3ds", rommPlatformSlug: "3ds" },
  { igdbPlatformId: 130, sourcePlatformName: "switch", rommPlatformSlug: "switch" },
  // Slugs follow RomM's own platform slugs (backend/utils/platform_slugs.py).
  { igdbPlatformId: 7, sourcePlatformName: "ps", rommPlatformSlug: "psx" },
  { igdbPlatformId: 8, sourcePlatformName: "ps2", rommPlatformSlug: "ps2" },
  { igdbPlatformId: 9, sourcePlatformName: "ps3", rommPlatformSlug: "ps3" },
  { igdbPlatformId: 48, sourcePlatformName: "ps4", rommPlatformSlug: "ps4" },
  { igdbPlatformId: 167, sourcePlatformName: "ps5", rommPlatformSlug: "ps5" },
  { igdbPlatformId: 46, sourcePlatformName: "psvita", rommPlatformSlug: "psvita" },
  { igdbPlatformId: 38, sourcePlatformName: "psp", rommPlatformSlug: "psp" },
  { igdbPlatformId: 35, sourcePlatformName: "gamegear", rommPlatformSlug: "gamegear" },
  { igdbPlatformId: 64, sourcePlatformName: "mastersystem", rommPlatformSlug: "mastersystem" },
  { igdbPlatformId: 29, sourcePlatformName: "genesis", rommPlatformSlug: "genesis" },
  { igdbPlatformId: 23, sourcePlatformName: "dc", rommPlatformSlug: "dc" },
  { igdbPlatformId: 32, sourcePlatformName: "saturn", rommPlatformSlug: "saturn" },
  { igdbPlatformId: 11, sourcePlatformName: "xbox", rommPlatformSlug: "xbox" },
  { igdbPlatformId: 12, sourcePlatformName: "xbox360", rommPlatformSlug: "xbox360" },
  { igdbPlatformId: 49, sourcePlatformName: "xboxone", rommPlatformSlug: "xboxone" },
  { igdbPlatformId: 169, sourcePlatformName: "xboxseries", rommPlatformSlug: "series-x-s" },
  { igdbPlatformId: 59, sourcePlatformName: "atari2600", rommPlatformSlug: "atari2600" },
  { igdbPlatformId: 80, sourcePlatformName: "neogeoaes", rommPlatformSlug: "neogeoaes" },
];

export class PlatformMappingService {
  constructor(private readonly storage: IStorage) {}

  async initializeDefaults(): Promise<void> {
    if (typeof this.storage.seedPlatformMappingsIfEmpty === "function") {
      const result = await this.storage.seedPlatformMappingsIfEmpty(DEFAULT_MAPPINGS);
      if (result?.seeded) {
        console.log(`Seeding default platform mappings complete (${result.count} rows).`);
      }
      return;
    }

    const existing = await this.storage.getPlatformMappings();
    if (existing.length === 0) {
      for (const map of DEFAULT_MAPPINGS) {
        await this.storage.addPlatformMapping(map);
      }
    }
  }

  /**
   * Adds the default mapping for every IGDB platform that has none yet, leaving existing
   * mappings (and the user's edits to them) alone. Returns how many were added.
   */
  async addMissingDefaults(): Promise<number> {
    const existing = new Set(
      (await this.storage.getPlatformMappings()).map((m) => m.igdbPlatformId)
    );
    let added = 0;
    for (const map of DEFAULT_MAPPINGS) {
      if (existing.has(map.igdbPlatformId)) continue;
      await this.storage.addPlatformMapping(map);
      added++;
    }
    return added;
  }

  async getAllMappings(): Promise<PlatformMapping[]> {
    return this.storage.getPlatformMappings();
  }

  async getSourcePlatform(igdbId: number): Promise<string | null> {
    const mapping = await this.storage.getPlatformMapping(igdbId);
    return mapping ? mapping.sourcePlatformName : null;
  }

  async addMapping(mapping: InsertPlatformMapping): Promise<PlatformMapping> {
    return this.storage.addPlatformMapping(mapping);
  }

  async updateMapping(
    id: string,
    updates: Partial<InsertPlatformMapping>
  ): Promise<PlatformMapping | undefined> {
    return this.storage.updatePlatformMapping(id, updates);
  }

  async removeMapping(id: string): Promise<boolean> {
    return this.storage.removePlatformMapping(id);
  }
}
