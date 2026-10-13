import path from "node:path";

const isParentDirectorySegment = (segment: string) => segment.trimEnd() === "..";

function hasParentDirectorySegment(value: string): boolean {
  return value.split(/[\\/]+/).some(isParentDirectorySegment);
}

/** Allow absolute downloader roots, but never a path that climbs out of its root. */
export function isSafeConfiguredDownloadPath(value: string): boolean {
  const normalized = value.trim();
  return !normalized.includes("\0") && !hasParentDirectorySegment(normalized);
}

/** Per-download overrides are relative subdirectories beneath the configured root. */
export function isSafeDownloadPathOverride(value: string): boolean {
  const normalized = value.trim();
  return (
    isSafeConfiguredDownloadPath(normalized) &&
    !path.posix.isAbsolute(normalized) &&
    !path.win32.isAbsolute(normalized)
  );
}
