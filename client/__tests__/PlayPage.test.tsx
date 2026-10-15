/** @vitest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayPage from "../src/pages/play";
import { GHOST_UNLOCK_KEY } from "../src/lib/ghost-mode";

const { mockToast, mockNavigate, mockGame } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockGame: {
    callbacks: null as unknown,
    seed: 0,
    start: vi.fn(),
    setPaused: vi.fn(),
    regenerate: vi.fn(),
    dispose: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/play", mockNavigate],
}));

vi.mock("@/game/infiltration-game", () => ({
  InfiltrationGame: class {
    constructor(_canvas: HTMLCanvasElement, seed: number, callbacks: unknown) {
      mockGame.seed = seed;
      mockGame.callbacks = callbacks;
    }

    start() {
      mockGame.start();
    }

    setPaused(paused: boolean) {
      mockGame.setPaused(paused);
      const callbacks = mockGame.callbacks as { onPauseChange?: (value: boolean) => void } | null;
      callbacks?.onPauseChange?.(paused);
    }

    regenerate(seed: number) {
      mockGame.regenerate(seed);
      mockGame.seed = seed;
    }

    dispose() {
      mockGame.dispose();
    }
  },
}));

describe("PlayPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/play?seed=1234");
    mockGame.callbacks = null;
    mockGame.seed = 0;
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("runs the seeded game and unlocks Ghost Mode when the terminal is hacked", () => {
    const { unmount } = render(<PlayPage />);
    const callbacks = () =>
      mockGame.callbacks as { onWin?: () => void; onCaught?: () => void } | null;

    expect(mockGame.seed).toBe(1234);
    expect(mockGame.start).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Ghost the Terminal" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Begin infiltration" }));
    expect(mockGame.setPaused).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Pause the infiltration" })).toBeInTheDocument();

    act(() => callbacks()?.onWin?.());

    expect(screen.getByRole("heading", { name: "Terminal hacked" })).toBeInTheDocument();
    expect(localStorage.getItem(GHOST_UNLOCK_KEY)).toBe("true");

    act(() => callbacks()?.onCaught?.());
    expect(mockToast).toHaveBeenCalledWith({
      description: "Spotted. Incident report filed — back to the entry point.",
    });

    unmount();
    expect(mockGame.dispose).toHaveBeenCalledOnce();
  });
});
