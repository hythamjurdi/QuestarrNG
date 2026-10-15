/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { DownloadStatus, Game } from "@shared/schema";

import AppSidebar from "../src/components/AppSidebar";
import { SidebarProvider } from "../src/components/ui/sidebar";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ logout: vi.fn(), user: { username: "tester" } }),
}));

vi.mock("@/components/GitHubVersionLink", () => ({
  GitHubVersionLink: () => null,
}));

function renderSidebar(statuses: string[], downloads: DownloadStatus[] = [], activeItem = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: () => null } },
  });
  queryClient.setQueryData(
    ["/api/games"],
    statuses.map((status, i) => ({ id: `g${i}`, status }) as unknown as Game)
  );
  queryClient.setQueryData(["/api/downloads"], { downloads });
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar activeItem={activeItem} />
      </SidebarProvider>
    </QueryClientProvider>
  );
}

describe("AppSidebar library counts", () => {
  it("shows the library total, wishlist and playing counts", () => {
    renderSidebar(["wanted", "playing", "playing", "owned", "completed"]);
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByRole("button", { name: "All Games, 5 games" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wishlist, 1 game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Playing, 2 games" })).toBeInTheDocument();
    expect(screen.getByTestId("badge-all-games")).toHaveTextContent("5");
    expect(screen.getByTestId("badge-playing")).toHaveTextContent("2");
  });

  it("styles the playing count with the playing status color, unlike the wishlist", () => {
    renderSidebar(["wanted", "playing"]);
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByTestId("badge-playing")).toHaveClass("bg-cyan-600");
    expect(screen.getByTestId("badge-wishlist")).not.toHaveClass("bg-cyan-600");
  });

  it("hides the counts when there is nothing to count", () => {
    renderSidebar([]);

    expect(screen.queryByTestId("badge-all-games")).not.toBeInTheDocument();
    expect(screen.queryByTestId("badge-playing")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Playing" })).toBeInTheDocument();
  });

  it("keeps lower-priority pages collapsed while preserving live badges under More", () => {
    renderSidebar(["wanted"], [{ status: "downloading" } as unknown as DownloadStatus]);

    expect(screen.queryByTestId("nav-calendar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-wishlist")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Downloads, 1 active download" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByTestId("nav-calendar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wishlist, 1 game" })).toBeInTheDocument();
  });

  it("opens More when a low-priority route is active", () => {
    renderSidebar([], [], "/calendar");

    expect(screen.getByTestId("nav-calendar")).toBeVisible();
  });

  it("lists Library Import under Library", () => {
    renderSidebar([]);

    expect(screen.getByRole("button", { name: "Library Import" })).toBeInTheDocument();
  });
});
