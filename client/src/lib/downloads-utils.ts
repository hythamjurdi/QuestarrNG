import type { DownloadStatus, DownloadStatusType, DownloadType } from "@shared/schema";
import { formatBytes } from "@/lib/utils";
import { formatRegionalNumber } from "@/lib/regional-format";
export { formatBytes } from "@/lib/utils";

export type { DownloadStatusType, DownloadType };

export type DownloadData = DownloadStatus;

/**
 * Format download/upload speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + "/s";
}

/**
 * Format ETA (estimated time of arrival)
 */
export function formatETA(seconds: number): string {
  if (seconds <= 0) return "∞";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get badge variant for status
 */
export function getStatusBadgeVariant(
  status: DownloadStatusType
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "downloading":
    case "seeding":
    case "repairing":
    case "unpacking":
      return "default";
    case "completed":
      return "outline";
    case "paused":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Filter downloads by status
 */
export function filterDownloadsByStatus<T extends DownloadData>(
  downloads: T[],
  filter: DownloadStatusType | "all"
): T[] {
  if (filter === "all") {
    return downloads;
  }
  return downloads.filter((d) => d.status === filter);
}

/**
 * Check if download speed badge should be shown
 * Speed badge is shown when speed is defined and greater than 0
 */
export function shouldShowSpeedBadge(speed: number | undefined): boolean {
  return speed !== undefined && speed > 0;
}

/**
 * Check if ETA badge should be shown
 * ETA badge is shown when ETA is defined and greater than 0
 */
export function shouldShowETABadge(eta: number | undefined): boolean {
  return eta !== undefined && eta > 0;
}

/**
 * Check if ratio badge should be shown
 * Ratio badge is shown when ratio is defined and >= 0
 */
export function shouldShowRatioBadge(ratio: number | undefined): boolean {
  return ratio !== undefined && ratio >= 0;
}

/**
 * Check if size badge should be shown
 * Size badge is shown when size is defined and greater than 0
 */
export function shouldShowSizeBadge(size: number | undefined): boolean {
  return size !== undefined && size > 0;
}

/**
 * Check if peers badge should be shown
 * Peers badge is shown when seeders count is defined
 */
export function shouldShowPeersBadge(seeders: number | undefined): boolean {
  return seeders !== undefined;
}

/**
 * Get CSS class for download type color
 */
export function getDownloadTypeColor(type?: DownloadType): string {
  if (type === "usenet") {
    return "bg-amber-600 dark:bg-amber-500 text-white border-amber-700 dark:border-amber-400";
  }
  return "bg-violet-600 dark:bg-violet-500 text-white border-violet-700 dark:border-violet-400";
}

/**
 * Format download type for display
 */
export function formatDownloadType(type?: DownloadType): string {
  if (!type) return "Torrent"; // Default to torrent for backward compatibility
  return type === "torrent" ? "Torrent" : "Usenet";
}

/**
 * Check if torrent-specific metrics should be shown (seeders/leechers/ratio)
 */
export function shouldShowTorrentMetrics(download: DownloadData): boolean {
  // Show torrent metrics if explicitly torrent or if type is undefined (backward compatibility)
  return download.downloadType !== "usenet";
}

/**
 * Check if Usenet-specific metrics should be shown (grabs/age)
 */
export function shouldShowUsenetMetrics(download: DownloadData): boolean {
  return download.downloadType === "usenet";
}

/**
 * Check if repair status should be shown
 */
export function shouldShowRepairStatus(download: DownloadData): boolean {
  return download.downloadType === "usenet" && download.repairStatus !== undefined;
}

/**
 * Check if unpack status should be shown
 */
export function shouldShowUnpackStatus(download: DownloadData): boolean {
  return download.downloadType === "usenet" && download.unpackStatus !== undefined;
}

/**
 * Get repair status badge variant
 */
export function getRepairStatusBadgeVariant(
  repairStatus?: "good" | "repairing" | "failed"
): "default" | "destructive" | "outline" {
  switch (repairStatus) {
    case "good":
      return "outline";
    case "repairing":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Get unpack status badge variant
 */
export function getUnpackStatusBadgeVariant(
  unpackStatus?: "unpacking" | "completed" | "failed"
): "default" | "destructive" | "outline" {
  switch (unpackStatus) {
    case "completed":
      return "outline";
    case "unpacking":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Format repair status for display
 */
export function formatRepairStatus(repairStatus?: "good" | "repairing" | "failed"): string {
  switch (repairStatus) {
    case "good":
      return "Repair OK";
    case "repairing":
      return "Repairing...";
    case "failed":
      return "Repair Failed";
    default:
      return "Unknown";
  }
}

/**
 * Format unpack status for display
 */
export function formatUnpackStatus(unpackStatus?: "unpacking" | "completed" | "failed"): string {
  switch (unpackStatus) {
    case "completed":
      return "Unpacked";
    case "unpacking":
      return "Unpacking...";
    case "failed":
      return "Unpack Failed";
    default:
      return "Unknown";
  }
}

/**
 * Format age in days to human-readable string
 */
export function formatAge(days?: number, locale?: string, numberPreference?: string): string {
  if (days === undefined) return "";
  if (locale !== undefined) {
    const ageInDays = Math.max(0, days);
    const formatRelativeTime = (
      value: number,
      unit: Intl.RelativeTimeFormatUnit,
      numeric: Intl.RelativeTimeFormatOptions["numeric"] = "always"
    ) => {
      const formatter = new Intl.RelativeTimeFormat(locale, { numeric });
      if (numberPreference === undefined) return formatter.format(value, unit);
      const relativeTime = formatter.format(value, unit);
      const interfaceNumber = new Intl.NumberFormat(locale).format(Math.abs(value));
      const regionalNumber = formatRegionalNumber(Math.abs(value), undefined, numberPreference);
      return relativeTime.replace(interfaceNumber, regionalNumber);
    };
    if (ageInDays === 0) return formatRelativeTime(0, "day", "auto");

    const wholeDays = Math.floor(ageInDays);
    if (wholeDays < 1) {
      const wholeHours = Math.max(1, Math.floor(ageInDays * 24));
      return formatRelativeTime(-wholeHours, "hour");
    }

    return formatRelativeTime(-wholeDays, "day");
  }

  if (days === 0) return "Today";
  const wholeDays = Math.floor(days);
  if (wholeDays < 1) return "< 1 day";
  if (wholeDays === 1) return "1 day";
  return `${wholeDays} days`;
}

/**
 * Check if an item is a Usenet download (NZB) vs torrent
 */
export function isUsenetItem(item: {
  grabs?: number;
  age?: number;
  seeders?: number;
  downloadType?: "torrent" | "usenet";
}): boolean {
  if (item.downloadType !== undefined) {
    return item.downloadType === "usenet";
  }
  return (item.grabs !== undefined || item.age !== undefined) && item.seeders === undefined;
}
