import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

export type ImportStage =
  "checking" | "verifying" | "extracting" | "copying" | "finishing" | "done" | "failed";

export interface ImportProgressState {
  downloadId: string;
  gameId: string;
  title: string;
  stage: ImportStage;
  detail?: string;
  percent?: number;
  step?: { current: number; total: number };
  rommSlug?: string;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

const QUERY_KEY = ["/api/imports/progress"];

/**
 * Imports running now (or just finished), keyed by the tracked download id. Loads the
 * current list once, then follows the server's "importProgress" socket events.
 */
export function useImportProgress(): Map<string, ImportProgressState> {
  const queryClient = useQueryClient();
  const { data } = useQuery<ImportProgressState[]>({ queryKey: QUERY_KEY });

  useEffect(() => {
    const socket = getSocket();
    const handler = (state: ImportProgressState) => {
      if (!state || typeof state.downloadId !== "string") return;
      queryClient.setQueryData<ImportProgressState[]>(QUERY_KEY, (current) => {
        const list = Array.isArray(current) ? current : [];
        return [...list.filter((s) => s.downloadId !== state.downloadId), state];
      });
      if (state.stage === "done" || state.stage === "failed") {
        queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/imports/pending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      }
    };
    socket.on("importProgress", handler);
    return () => {
      socket.off("importProgress", handler);
    };
  }, [queryClient]);

  return useMemo(
    () => new Map((Array.isArray(data) ? data : []).map((s) => [s.downloadId, s])),
    [data]
  );
}
