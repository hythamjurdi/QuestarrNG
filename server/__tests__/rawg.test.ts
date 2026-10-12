import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock("../ssrf.js", () => ({ safeFetch }));

import { formatRawgGame, rawgClient } from "../rawg.js";

describe("optional RAWG provider", () => {
  beforeEach(() => {
    safeFetch.mockReset();
    rawgClient.clearCache();
  });

  it("maps RAWG IDs and metadata without taking the IGDB identity", () => {
    const game = formatRawgGame({
      id: 4312,
      slug: "sample-game",
      name: "Sample Game",
      rating: 4.25,
      released: "2020-04-05",
      esrb_rating: { id: 4, name: "Mature" },
      platforms: [{ platform: { id: 4, name: "PC" } }],
      genres: [{ id: 3, name: "Adventure" }],
    });

    expect(game).toMatchObject({
      id: "rawg-4312",
      rawgId: 4312,
      rawgSlug: "sample-game",
      igdbId: null,
      rating: 8.5,
      releaseDate: "2020-04-05",
      platforms: ["PC"],
      genres: ["Adventure"],
      isAgeRestricted: true,
      source: "rawg",
    });
  });

  it("uses RAWG's documented API-key parameter and caches successful results", async () => {
    safeFetch.mockResolvedValue(
      new Response(JSON.stringify({ results: [{ id: 1, name: "Game", slug: "game" }] }), {
        headers: { "content-type": "application/json" },
      })
    );
    expect((await rawgClient.popular("example-secret", 1))[0]).toMatchObject({
      rawgId: 1,
      title: "Game",
    });
    const [requestUrl] = safeFetch.mock.calls[0] as [string];
    expect(new URL(requestUrl).origin).toBe("https://api.rawg.io");
    expect(new URL(requestUrl).searchParams.get("key")).toBe("example-secret");
    expect(safeFetch).toHaveBeenCalledTimes(1);
    await rawgClient.popular("example-secret", 1);
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });

  it("returns a safe settings error for rejected credentials", async () => {
    safeFetch.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    expect(await rawgClient.testCredentials("invalid-key")).toEqual({
      success: false,
      message: "RAWG rejected the API key. Check the key in Settings.",
    });
  });
});
