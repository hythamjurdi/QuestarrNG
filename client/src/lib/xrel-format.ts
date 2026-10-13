import { formatRegionalNumber } from "@/lib/regional-format";

export function formatXrelSize(mb?: number, unit?: string): string {
  if (mb == null) return "—";
  if (unit === "GB")
    return `${formatRegionalNumber(mb, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  if (mb >= 1024 && !unit)
    return `${formatRegionalNumber(mb / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
  return `${formatRegionalNumber(mb)} ${unit || "MB"}`;
}
