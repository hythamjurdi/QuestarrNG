// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RssFeedItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import RssFeedList from "../src/components/RssFeedList";

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

const mockApiRequest = vi.mocked(apiRequest);
const item = {
  id: "rss-item-1",
  title: "A Very Good Release",
  link: "https://example.test/releases/very-good",
  sourceName: "Example RSS",
  pubDate: "2026-10-13T12:00:00.000Z",
} as unknown as RssFeedItem;

function renderFeedList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RssFeedList />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("RssFeedList accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue({ json: async () => [item] } as Response);
  });

  it("names the view toggles and article links in both layouts", async () => {
    renderFeedList();

    const gridButton = await screen.findByRole("button", { name: "Grid View" });
    const listButton = screen.getByRole("button", { name: "List View" });
    const articleName = `View original article for ${item.title}`;
    const gridArticle = screen.getByRole("link", { name: articleName });

    expect(gridArticle.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(listButton);

    const listArticle = await screen.findByRole("link", { name: articleName });
    expect(gridButton).toBeInTheDocument();
    expect(listArticle.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
