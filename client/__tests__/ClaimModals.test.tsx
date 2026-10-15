/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClaimBatchModal from "../src/components/ClaimBatchModal";
import ClaimDownloadModal from "../src/components/ClaimDownloadModal";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const result = await fetch(queryKey.join(""));
          if (!result.ok) throw new Error("Request failed");
          return result.json();
        },
      },
      mutations: { retry: false },
    },
  });
}

const igdbCandidate = {
  id: "igdb-123",
  igdbId: 123,
  title: "Candidate Game",
  coverUrl: null,
  summary: null,
  releaseDate: null,
  platforms: [],
  genres: [],
};

describe("claim dialog regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("claims an IGDB batch selection as a new game and reports the server's linked count", async () => {
    let submittedBody: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/downloads/scan") {
        return response({
          groups: [
            {
              baseTitle: "Candidate Game",
              downloads: [
                {
                  downloaderId: "downloader-1",
                  downloaderName: "Deluge",
                  downloadId: "hash-1",
                  downloadHash: "hash-1",
                  downloadTitle: "Candidate Game",
                  status: "completed",
                  downloadType: "torrent",
                  category: "main",
                  categoryConfidence: 1,
                },
              ],
              libraryMatch: null,
            },
          ],
        });
      }
      if (url.includes("/api/igdb/search")) return response([igdbCandidate]);
      if (url === "/api/downloads/claim-batch" && init?.method === "POST") {
        submittedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return response({ addedCount: 1, failedCount: 0, skippedCount: 0 });
      }
      return response([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <ClaimBatchModal open onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("No library match found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search IGDB/ }));
    await screen.findByRole("button", { name: "Candidate Game" });

    fireEvent.click(screen.getByRole("button", { name: "Candidate Game" }));
    fireEvent.click(screen.getByRole("button", { name: "Claim 1" }));

    await waitFor(() => expect(submittedBody).toBeDefined());
    const items = submittedBody?.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty("gameId");
    expect(items[0]?.newGame).toMatchObject({ igdbId: 123, title: "Candidate Game" });
    expect(toastMock).toHaveBeenCalledWith({ title: "Linked 1 group to a game" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides stale IGDB results after the search text becomes shorter than three characters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/games") return response([]);
      if (url.includes("/api/igdb/search")) return response([igdbCandidate]);
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <ClaimDownloadModal
          open
          onOpenChange={onOpenChange}
          download={{
            id: "hash-2",
            name: "Candidate Game release",
            status: "downloading",
            downloaderId: "downloader-1",
            downloaderName: "Deluge",
          }}
        />
      </QueryClientProvider>
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: "IGDB Search" }), { button: 0 });
    const searchInput = await screen.findByPlaceholderText("Search IGDB…");
    fireEvent.change(searchInput, { target: { value: "Candidate Game" } });
    expect(await screen.findByRole("button", { name: "Candidate Game" })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Ca" } });
    await waitFor(
      () => {
        expect(screen.queryByRole("button", { name: "Candidate Game" })).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
