import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { applyInitialInterfaceLanguage } from "@/lib/interface-locale";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ logout: vi.fn(), user: { username: "test-user" } }),
}));

describe("AppSidebar translated labels", () => {
  beforeEach(() => {
    localStorage.setItem("questarr.interface-language", "ar");
    applyInitialInterfaceLanguage();
  });

  it("marks collapsible navigation labels with their translated language and direction", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(["/api/games"], []);
    queryClient.setQueryData(["/api/downloads"], { downloads: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </QueryClientProvider>
    );

    const libraryButton = screen.getByTestId("nav-library");
    const translatedLabel = within(libraryButton).getByText("المكتبة");

    expect(translatedLabel).toHaveAttribute("lang", "ar");
    expect(translatedLabel).toHaveAttribute("dir", "rtl");
  });
});
