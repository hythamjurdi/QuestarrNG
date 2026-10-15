// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RssFeed } from "@shared/schema";
import RssSettings from "../src/components/RssSettings";
import { apiRequest } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const mockApiRequest = vi.mocked(apiRequest);
const feed = {
  id: "feed-1",
  name: "Nightly Releases",
  url: "https://example.test/rss",
  type: "custom",
  enabled: true,
  status: "ok",
  errorMessage: null,
} as RssFeed;

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RssSettings />
    </QueryClientProvider>
  );
}

describe("RssSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives each feed delete action a descriptive accessible name and disables it while pending", async () => {
    let finishDelete: (() => void) | undefined;
    mockApiRequest.mockImplementation((method, url) => {
      if (method === "GET" && url === "/api/rss/feeds") {
        return Promise.resolve({ json: async () => [feed] } as Response);
      }
      if (method === "DELETE" && url === "/api/rss/feeds/feed-1") {
        return new Promise<Response>((resolve) => {
          finishDelete = () => resolve({ ok: true } as Response);
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${method} ${url}`));
    });

    renderSettings();
    fireEvent.click(await screen.findByRole("button", { name: "Manage Feeds" }));

    const deleteButton = await screen.findByRole("button", {
      name: "Delete feed Nightly Releases",
    });
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);
    await waitFor(() => expect(deleteButton).toBeDisabled());

    finishDelete?.();
    await waitFor(() => expect(deleteButton).toBeEnabled());
    expect(mockApiRequest).toHaveBeenCalledWith("DELETE", "/api/rss/feeds/feed-1");
  });
});
