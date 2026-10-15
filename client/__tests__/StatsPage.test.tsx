/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StatsPage from "../src/pages/stats";
import { formatRegionalPercent, setRegionalPreference } from "../src/lib/regional-format";
import { createTestQueryClient } from "./test-utils";

const { apiRequestMock, games } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  games: [
    {
      id: "game-1",
      title: "Game One",
      status: "wanted",
      genres: ["RPG", "Adventure"],
      platforms: ["PC"],
      publishers: [],
      developers: [],
      rating: null,
      userRating: null,
    },
    {
      id: "game-2",
      title: "Game Two",
      status: "owned",
      genres: ["RPG"],
      platforms: ["PC", "Switch"],
      publishers: [],
      developers: [],
      rating: null,
      userRating: null,
    },
  ],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Stub apiRequest so game and discord-config queries resolve without network
vi.mock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("@/components/StatsCard", () => ({
  default: ({ title, value }: { title: string; value: number | string }) => (
    <div data-testid="stats-card">
      {title}: {value}
    </div>
  ),
}));

vi.mock("@/components/ShareDiscordDialog", () => ({
  default: () => null,
}));

vi.mock("recharts", () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
  Tooltip: () => null,
}));

describe("StatsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRegionalPreference("system");
    apiRequestMock.mockImplementation(async (_method: string, path: string) => ({
      json: async () => (path.startsWith("/api/games") ? games : { configured: false }),
    }));
  });

  it("renders the Statistics heading", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StatsPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Statistics")).toBeInTheDocument();
  });

  it("renders stats cards when games are loaded", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StatsPage />
      </QueryClientProvider>
    );

    const cards = await screen.findAllByTestId("stats-card");
    expect(cards).toHaveLength(8);
  });

  it("shows unique genre, platform, and wishlist counts", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StatsPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Genres: 2")).toBeInTheDocument();
    expect(screen.getByText("Platforms: 2")).toBeInTheDocument();
    expect(screen.getByText("Wishlist: 1")).toBeInTheDocument();
  });

  it("formats percentage cards with the selected regional locale", async () => {
    setRegionalPreference("fr");

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <StatsPage />
      </QueryClientProvider>
    );

    const cards = await screen.findAllByTestId("stats-card");
    const completionCard = cards.find((card) => card.textContent?.startsWith("Completion Rate"));

    expect(completionCard?.textContent).toBe(
      `Completion Rate: ${formatRegionalPercent(0, { maximumFractionDigits: 0 })}`
    );
  });
});
