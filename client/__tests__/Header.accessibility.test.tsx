/** @vitest-environment jsdom */
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "../src/components/Header";
import { createTestQueryClient, getRequestUrl } from "./test-utils";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button" aria-label="Toggle Sidebar" />,
}));

vi.mock("../src/components/NotificationCenter", () => ({
  NotificationCenter: () => null,
}));

vi.mock("../src/components/AddGameModal", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <>
      <span data-testid="add-game-modal-loaded" hidden />
      {children}
    </>
  ),
}));

describe("Header accessibility", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      const data = url.includes("/api/config")
        ? { igdb: { configured: true } }
        : url.includes("/api/auth/me")
          ? { id: "test-user", username: "admin" }
          : [];
      return { ok: true, json: async () => data } as Response;
    }) as typeof fetch;
  });

  it("gives the icon-only Add Game action a descriptive accessible name", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <Header />
      </QueryClientProvider>
    );

    await screen.findByTestId("add-game-modal-loaded");
    expect(screen.getByRole("button", { name: "Add Game", exact: true })).toHaveAccessibleName(
      "Add Game"
    );
  });
});
