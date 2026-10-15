/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SendErrorReportDialog from "../src/components/SendErrorReportDialog";
import { throwIfResNotOk } from "@/lib/queryClient";

const { apiRequestMock, toastMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: apiRequestMock };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const reportId = "4cdb6e77-3536-42bd-92b7-c60d34fff601";
const metadata = {
  lineCount: 8,
  appVersion: "1.10.0",
  platform: "server",
  timestamp: "2026-10-14T12:00:00.000Z",
};

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const response = await fetch(queryKey.join("/"));
          await throwIfResNotOk(response);
          return response.json();
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <SendErrorReportDialog open onOpenChange={vi.fn()} reportId={reportId} />
    </QueryClientProvider>
  );
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SendErrorReportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows what will be shared and sends only after the user confirms", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(metadata)));
    vi.stubGlobal("fetch", fetchMock);
    apiRequestMock.mockResolvedValue({
      json: async () => ({ code: "SUP-123", issueNumber: 42 }),
    });

    renderDialog();

    expect(await screen.findByRole("heading", { name: "An error occurred" })).toBeInTheDocument();
    expect(screen.getByText(/8 most recent server log lines/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("App version");
    expect(screen.getByRole("dialog")).toHaveTextContent("1.10.0");
    expect(apiRequestMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByRole("heading", { name: "Report sent" })).toBeInTheDocument();
    expect(screen.getByText("SUP-123")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith("POST", `/api/telemetry/pending/${reportId}/send`);
  });

  it("shows the expired state only when the metadata endpoint returns 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "missing" }, 404)));

    renderDialog();

    expect(
      await screen.findByRole("heading", { name: "Report no longer available" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send report" })).not.toBeInTheDocument();
  });

  it("lets the user retry a transient metadata error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "temporarily unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse(metadata));
    vi.stubGlobal("fetch", fetchMock);

    renderDialog();

    expect(
      await screen.findByRole("heading", { name: "Couldn't load report" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "An error occurred" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
