import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { HLTBClient, hltbClient, hltbRouter } from "../hltb.js";
import { safeFetch } from "../ssrf.js";

vi.mock("../ssrf.js", () => ({ safeFetch: vi.fn() }));

vi.mock("../auth.js", () => ({
  authenticateToken: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../logger.js", () => ({
  logger: { child: () => ({ debug: vi.fn() }) },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hltbResponse(
  options: Partial<{
    game_id: number;
    game_name: string;
    comp_main: number;
    comp_plus: number;
    comp_100: number;
  }> = {}
) {
  return {
    data: [
      {
        game_id: 123,
        game_name: "The Example Game",
        comp_main: 25 * 3600,
        comp_plus: 40 * 3600,
        comp_100: 65 * 3600,
        ...options,
      },
    ],
  };
}

function makeFetcher(response: Response): typeof safeFetch {
  return vi.fn<typeof safeFetch>().mockResolvedValue(response);
}

describe("HLTBClient", () => {
  it("returns the closest title match with completion times in hours", async () => {
    const fetcher = makeFetcher(jsonResponse(hltbResponse()));
    const client = new HLTBClient(fetcher);

    await expect(client.lookup("The Example Game")).resolves.toEqual({
      id: 123,
      name: "The Example Game",
      gameplayMain: 25,
      gameplayMainExtra: 40,
      gameplayCompletionist: 65,
      url: "https://howlongtobeat.com/game/123",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://howlongtobeat.com/api/search",
      expect.objectContaining({ method: "POST", timeoutMs: 10_000, requireHttps: true })
    );
    const options = vi.mocked(fetcher).mock.calls[0]?.[1];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      searchType: "games",
      searchTerms: ["The", "Example", "Game"],
      size: 20,
    });
  });

  it("normalizes title punctuation and caches successful lookups", async () => {
    const fetcher = makeFetcher(jsonResponse(hltbResponse()));
    const client = new HLTBClient(fetcher);

    const first = await client.lookup("The Example: Game!");
    const second = await client.lookup(" the example game ");

    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("caches definitive no-match results", async () => {
    const fetcher = makeFetcher(jsonResponse({ data: [] }));
    const client = new HLTBClient(fetcher);

    await expect(client.lookup("No Such Game")).resolves.toBeNull();
    await expect(client.lookup("No Such Game")).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not cache non-200 responses and succeeds on retry", async () => {
    const fetcher = vi
      .fn<typeof safeFetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(hltbResponse()));
    const client = new HLTBClient(fetcher);

    await expect(client.lookup("The Example Game")).resolves.toBeNull();
    await expect(client.lookup("The Example Game")).resolves.toMatchObject({ id: 123 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not cache network or malformed-response failures", async () => {
    const fetcher = vi
      .fn<typeof safeFetch>()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(jsonResponse({ data: "not an array" }))
      .mockResolvedValueOnce(jsonResponse(hltbResponse()));
    const client = new HLTBClient(fetcher);

    await expect(client.lookup("The Example Game")).resolves.toBeNull();
    await expect(client.lookup("The Example Game")).resolves.toBeNull();
    await expect(client.lookup("The Example Game")).resolves.toMatchObject({ id: 123 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects weak title matches rather than showing another game's times", async () => {
    const fetcher = makeFetcher(
      jsonResponse(hltbResponse({ game_name: "A Completely Different Adventure" }))
    );
    const client = new HLTBClient(fetcher);

    await expect(client.lookup("The Example Game")).resolves.toBeNull();
  });
});

describe("GET /api/hltb/lookup", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    hltbClient.clearCache();
    app = express();
    app.use(hltbRouter);
  });

  it("returns completion data for a valid title", async () => {
    vi.mocked(safeFetch).mockResolvedValue(jsonResponse(hltbResponse()));

    const res = await request(app).get("/api/hltb/lookup?title=The%20Example%20Game");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 123,
      gameplayMain: 25,
      gameplayMainExtra: 40,
      gameplayCompletionist: 65,
    });
  });

  it("rejects missing, blank, and oversized titles before contacting HLTB", async () => {
    const [missing, blank, oversized] = await Promise.all([
      request(app).get("/api/hltb/lookup"),
      request(app).get("/api/hltb/lookup?title=%20%20"),
      request(app).get(`/api/hltb/lookup?title=${"a".repeat(201)}`),
    ]);

    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(safeFetch).not.toHaveBeenCalled();
  });
});
