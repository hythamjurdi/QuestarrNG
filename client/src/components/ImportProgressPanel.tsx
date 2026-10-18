import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { InterfaceText } from "@/components/InterfaceText";
import { formatInterfaceMessage } from "@/lib/interface-locale";
import type { ImportProgressState } from "@/hooks/use-import-progress";

const STAGE_LABELS: Record<ImportProgressState["stage"], string> = {
  checking: "Preparing import…",
  verifying: "Checking archive…",
  extracting: "Extracting…",
  copying: "Copying files…",
  finishing: "Finishing up…",
  done: "Imported",
  failed: "Import failed",
};

/** Live status of one import, shown on its download card. */
export function ImportProgressPanel({ state }: Readonly<{ state: ImportProgressState }>) {
  const running = state.stage !== "done" && state.stage !== "failed";
  const tone =
    state.stage === "failed"
      ? "border-destructive/40 bg-destructive/10"
      : state.stage === "done"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : "border-primary/30 bg-primary/5";

  return (
    <div
      className={`mt-3 space-y-1.5 rounded-md border p-3 text-xs ${tone}`}
      role="status"
      aria-live="polite"
      data-testid={`import-progress-${state.downloadId}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state.stage === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <InterfaceText source={STAGE_LABELS[state.stage]} />
        {state.step && running && (
          <span className="text-xs font-normal text-muted-foreground">
            {formatInterfaceMessage("Archive {current} of {total}", {
              current: state.step.current,
              total: state.step.total,
            })}
          </span>
        )}
        {state.rommSlug && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal">
            {formatInterfaceMessage("RomM · {platform}", { platform: state.rommSlug })}
          </span>
        )}
        {running && state.percent !== undefined && (
          <span className="ml-auto tabular-nums">{state.percent}%</span>
        )}
      </div>
      {running && (
        <Progress
          value={state.percent ?? 0}
          className={state.percent === undefined ? "h-1.5 animate-pulse" : "h-1.5"}
        />
      )}
      {state.stage === "failed" && state.error ? (
        <p className="break-words text-destructive" lang="und" dir="auto">
          {state.error}
        </p>
      ) : state.detail ? (
        <p className="break-all text-muted-foreground" lang="und" dir="auto">
          {state.stage === "done" ? "→ " : ""}
          {state.detail}
        </p>
      ) : null}
      {state.stage === "done" && state.rommSlug && (
        <p className="text-muted-foreground">
          <InterfaceText source={"RomM will be asked to scan this platform shortly."} />
        </p>
      )}
    </div>
  );
}
