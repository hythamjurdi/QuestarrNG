/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GameCarouselSection from "../src/components/GameCarouselSection";

const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({ useQuery: mockUseQuery }));

vi.mock("../src/components/GameCard", () => ({
  default: () => <div data-testid="game-card" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className: _className,
    size: _size,
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({
    children,
    className: _className,
    opts: _opts,
    plugins: _plugins,
    orientation: _orientation,
    setApi: _setApi,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    opts?: unknown;
    plugins?: unknown;
    orientation?: string;
    setApi?: unknown;
  }) => (
    <div {...props} role="region" aria-roledescription="carousel">
      {children}
    </div>
  ),
  CarouselContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  CarouselItem: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

describe("GameCarouselSection", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("announces refreshes and removes stale carousel controls from keyboard navigation", () => {
    mockUseQuery.mockReturnValue({
      data: [{ id: "game-1" }],
      isLoading: false,
      isFetching: true,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });

    render(<GameCarouselSection title="Popular Games" queryKey={["popular"]} queryFn={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Updating Popular Games…");
    expect(screen.getByRole("status").closest("[aria-busy]")).toBeNull();
    expect(
      screen.getByTestId("carousel-section-popular-games").querySelector("[aria-busy]")
    ).toHaveAttribute("aria-busy", "true");

    const carousel = document.querySelector('[aria-roledescription="carousel"]');
    expect(carousel).toHaveAttribute("aria-hidden", "true");
    expect(carousel).toHaveAttribute("inert");
  });

  it("keeps an empty carousel visible with a clear empty state", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });

    render(
      <GameCarouselSection title="Adventure Games" queryKey={["adventure"]} queryFn={vi.fn()} />
    );

    expect(screen.getByTestId("carousel-section-adventure-games-empty")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Adventure Games" })).toBeInTheDocument();
    expect(screen.getByText("No games found.")).toBeInTheDocument();
  });
});
