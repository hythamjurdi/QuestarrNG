/** @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setRegionalPreference } from "@/lib/regional-format";
import ClaimBatchModal from "../src/components/ClaimBatchModal";
import ClaimDownloadModal from "../src/components/ClaimDownloadModal";
import { type Game } from "@shared/schema";

const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

const game = {
  id: "game-1",
  igdbId: 1001,
  title: "Test Game",
  coverUrl: "",
  summary: "A test game",
  rating: 8.5,
  releaseDate: "2024-02-03T00:00:00.000Z",
  releaseStatus: "released",
  status: "wanted" as const,
  hidden: false,
  platforms: ["PC"],
  genres: ["Action"],
  addedAt: new Date("2024-02-03T00:00:00.000Z").toISOString(),
  updatedAt: new Date("2024-02-03T00:00:00.000Z").toISOString(),
} as unknown as Game;

const scanResponse = {
  groups: [
    {
      baseTitle: "Test Game",
      downloads: [
        {
          downloaderId: "downloader-1",
          downloaderName: "qBittorrent",
          downloadId: "download-1",
          downloadHash: "hash-1",
          downloadTitle: "Test Game release",
          status: "downloading",
          downloadType: "torrent" as const,
          category: "main" as const,
          categoryConfidence: 1,
        },
      ],
      libraryMatch: null,
    },
  ],
};

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe("regional full dates in download claim dialogs", () => {
  beforeEach(() => {
    act(() => setRegionalPreference("ja"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/downloads/scan")) return createJsonResponse(scanResponse);
        if (url.includes("/api/igdb/search")) return createJsonResponse([game]);
        return createJsonResponse([]);
      })
    );
  });

  afterEach(() => {
    act(() => setRegionalPreference("system"));
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("formats and annotates the library match date in ClaimDownloadModal", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["/api/games"], [game]);

    renderWithProviders(
      <ClaimDownloadModal
        download={{
          id: "download-1",
          name: "Test Game",
          status: "downloading",
          downloaderId: "downloader-1",
          downloaderName: "qBittorrent",
        }}
        open
        onOpenChange={vi.fn()}
      />,
      queryClient
    );

    fireEvent.change(screen.getByPlaceholderText("Search your library…"), {
      target: { value: "Test Game" },
    });
    fireEvent.pointerMove(screen.getByText("2024"), { pointerType: "mouse" });

    const fullDate = await screen.findByText("2024/02/03");
    expect(fullDate).toHaveAttribute("lang", "ja");
    expect(fullDate).toHaveAttribute("dir", "ltr");
  });

  it("formats and annotates IGDB result dates in ClaimBatchModal", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["/api/downloads/scan"], scanResponse);

    renderWithProviders(<ClaimBatchModal open onOpenChange={vi.fn()} />, queryClient);

    fireEvent.click(await screen.findByRole("button", { name: /Search IGDB/ }));
    const year = await screen.findByText("2024", {}, { timeout: 5000 });
    fireEvent.pointerMove(year, { pointerType: "mouse" });

    const fullDate = await screen.findByText("2024/02/03");
    expect(fullDate).toHaveAttribute("lang", "ja");
    expect(fullDate).toHaveAttribute("dir", "ltr");
  });
});
