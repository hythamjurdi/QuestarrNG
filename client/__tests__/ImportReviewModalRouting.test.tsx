/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportReviewModal from "../src/components/ImportReviewModal";

const { queryKeysSeen, planOverride } = vi.hoisted(() => ({
  queryKeysSeen: [] as string[],
  planOverride: { current: null as unknown },
}));

const PLAN = {
  originalPath: "/downloads/Castlevania.Belmonts.Curse.PS5-DUPLEX",
  proposedPath: "/romm/ps5/roms/Castlevania Belmont's Curse",
  files: [
    { name: "dup-cbc.rar", isArchive: true },
    { name: "dup-cbc.r00", isArchive: true },
  ],
  hasArchive: true,
  totalCount: 2,
  suggestedStrategy: "romm",
  romm: { slug: "ps5", platformDir: "/romm/ps5/roms", error: null },
  suggestUnpack: true,
};

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: string[] }) => {
      const key = queryKey[0]!;
      queryKeysSeen.push(key);
      if (key === "/api/imports/config") {
        return { data: { transferMode: "hardlink", libraryRoot: "/data", autoUnpack: false } };
      }
      if (key === "/api/imports/romm") {
        return { data: { enabled: true, libraryRoot: "/romm", moveMode: "hardlink" } };
      }
      return { data: planOverride.current ?? PLAN };
    },
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../src/components/FileBrowser", () => ({ FileBrowser: () => null }));

describe("ImportReviewModal routing summary", () => {
  it("preselects RomM, shows the target folder, enables unpack and hides Skip", async () => {
    render(
      <ImportReviewModal
        open
        onOpenChange={() => undefined}
        downloadId="gd-1"
        downloadTitle="Castlevania.Belmonts.Curse.PS5-DUPLEX"
        allowSkip={false}
      />
    );

    const summary = await screen.findByTestId("import-routing-summary");
    await waitFor(() => expect(summary).toHaveTextContent("Imports into RomM as ps5"));
    expect(summary).toHaveTextContent("/romm/ps5/roms/Castlevania Belmont's Curse");
    expect(summary).toHaveTextContent("keeps seeding");
    expect(queryKeysSeen.some((k) => k.includes("strategy=romm"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Skip Import" })).not.toBeInTheDocument();
  });

  it("applies a refetched plan, replacing a stale one that had no platform folder", async () => {
    // A stale cached plan (platform not mapped yet) is served first, then the fresh one.
    planOverride.current = {
      ...PLAN,
      proposedPath: "/data/PC/Castlevania",
      romm: { slug: null, platformDir: null, error: null, detectedPlatform: null },
    };
    const props = {
      open: true,
      onOpenChange: () => undefined,
      downloadId: "gd-1",
      downloadTitle: "Castlevania.Belmonts.Curse.PS5-DUPLEX",
      allowSkip: false,
    };
    const stale = planOverride.current as Record<string, unknown>;
    const { rerender } = render(<ImportReviewModal {...props} />);
    const destination = screen.getByLabelText("Destination Path");
    // The stale response again, as a new object once the source path has settled (what
    // the query returns for the source-specific URL from cache).
    planOverride.current = { ...stale };
    rerender(<ImportReviewModal {...props} />);
    expect(destination).not.toHaveValue("/data/PC/Castlevania");

    planOverride.current = { ...PLAN };
    rerender(<ImportReviewModal {...props} />);
    await waitFor(() =>
      expect(destination).toHaveValue("/romm/ps5/roms/Castlevania Belmont's Curse")
    );
    planOverride.current = null;
  });
});
