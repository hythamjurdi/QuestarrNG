// Name prefix of the per-run staging directory ArchiveService.extract() unpacks into, inside
// the destination, before merging. Kept short and free of the archive name so long release
// names never exceed the filesystem's 255-byte name limit. Directory walks over a library
// folder skip entries with this prefix: they are another import's work in progress, or the
// leftovers of one that was interrupted, never game content.
export const EXTRACT_STAGING_PREFIX = ".questarr-extract-";

// System-config key holding the optional extraction temp directory (Settings → Import →
// General Config). Empty or unset: stage beside the destination (same-filesystem rename).
export const EXTRACT_TEMP_DIR_CONFIG_KEY = "import.extractTempDir";
