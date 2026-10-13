import { Router } from "express";
import { authenticateToken } from "./auth.js";
import { logger } from "./logger.js";
import { safeFetch } from "./ssrf.js";

const hltbLogger = logger.child({ module: "hltb" });
const HLTB_API_URL = "https://howlongtobeat.com/api/search";
const HLTB_BASE_URL = "https://howlongtobeat.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const MIN_SIMILARITY = 0.6;

export interface HLTBEntry {
  id: number;
  name: string;
  gameplayMain: number;
  gameplayMainExtra: number;
  gameplayCompletionist: number;
  url: string;
}

interface CacheEntry {
  data: HLTBEntry | null;
  expires: number;
}

interface HLTBSearchResult {
  game_id: number;
  game_name: string;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
}

type HLTBFetcher = typeof safeFetch;

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** O(m·n) Levenshtein distance using two rows of memory. */
function levenshtein(a: string, b: string): number {
  if (a.length > b.length) [a, b] = [b, a];

  let previous = Array.from({ length: a.length + 1 }, (_, index) => index);
  let current = new Array<number>(a.length + 1);

  for (let row = 1; row <= b.length; row++) {
    current[0] = row;
    for (let column = 1; column <= a.length; column++) {
      current[column] =
        a[column - 1] === b[row - 1]
          ? previous[column - 1]!
          : 1 + Math.min(previous[column]!, current[column - 1]!, previous[column - 1]!);
    }
    [previous, current] = [current, previous];
  }

  return previous[a.length]!;
}

function similarity(left: string, right: string): number {
  const length = Math.max(left.length, right.length);
  return length === 0 ? 1 : 1 - levenshtein(left, right) / length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSearchResult(value: unknown): value is HLTBSearchResult {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.game_id) &&
    (value.game_id as number) > 0 &&
    typeof value.game_name === "string" &&
    value.game_name.trim().length > 0 &&
    Number.isFinite(value.comp_main) &&
    Number.isFinite(value.comp_plus) &&
    Number.isFinite(value.comp_100)
  );
}

export class HLTBClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<HLTBEntry | null>>();

  constructor(private readonly fetcher: HLTBFetcher = safeFetch) {}

  clearCache(): void {
    this.cache.clear();
    this.pending.clear();
  }

  async lookup(title: string): Promise<HLTBEntry | null> {
    const key = normalizeTitle(title);
    if (!key) return null;

    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expires) return cached.data;
    if (cached) this.cache.delete(key);

    const pending = this.pending.get(key);
    if (pending) return pending;

    const request = this.lookupFresh(key, title);
    this.pending.set(key, request);
    try {
      return await request;
    } finally {
      if (this.pending.get(key) === request) this.pending.delete(key);
    }
  }

  private async lookupFresh(key: string, title: string): Promise<HLTBEntry | null> {
    const result = await this.fetchBestMatch(title);
    // A definitive no-match is cacheable; undefined means the provider failed transiently.
    if (result !== undefined) {
      this.pruneCache();
      this.cache.set(key, { data: result, expires: Date.now() + CACHE_TTL_MS });
    }
    return result ?? null;
  }

  private pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now >= entry.expires) this.cache.delete(key);
    }
    while (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private async fetchBestMatch(title: string): Promise<HLTBEntry | null | undefined> {
    try {
      const body = {
        searchType: "games",
        searchTerms: title.split(/\s+/).filter(Boolean),
        searchPage: 1,
        size: 20,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: 0, max: 0 },
            gameplay: { perspective: "", flow: "", genre: "" },
            modifier: "",
          },
          users: { sortCategory: "postcount" },
          filter: "",
          sort: 0,
          randomizer: 0,
        },
      };

      const response = await this.fetcher(HLTB_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "QuestarrNG/1.0 (+https://github.com/snapetech/QuestarrNG)",
          Referer: `${HLTB_BASE_URL}/`,
          Origin: HLTB_BASE_URL,
        },
        body: JSON.stringify(body),
        timeoutMs: 10_000,
        requireHttps: true,
      });

      if (!response.ok) {
        hltbLogger.debug({ status: response.status, title }, "HLTB search returned non-200");
        return undefined;
      }

      const json: unknown = await response.json();
      if (!isRecord(json) || !Array.isArray(json.data)) return undefined;
      if (json.data.length === 0) return null;

      const candidates = json.data.filter(isSearchResult);
      if (candidates.length === 0) return undefined;

      const normalizedQuery = normalizeTitle(title);
      let best: { entry: HLTBSearchResult; score: number } | null = null;
      for (const entry of candidates) {
        const score = similarity(normalizeTitle(entry.game_name), normalizedQuery);
        if (!best || score > best.score) best = { entry, score };
      }

      if (!best || best.score < MIN_SIMILARITY) {
        hltbLogger.debug(
          { title, bestScore: best?.score },
          "No sufficiently similar HLTB result found"
        );
        return null;
      }

      const { entry } = best;
      return {
        id: entry.game_id,
        name: entry.game_name,
        gameplayMain: entry.comp_main > 0 ? Math.round(entry.comp_main / 3600) : 0,
        gameplayMainExtra: entry.comp_plus > 0 ? Math.round(entry.comp_plus / 3600) : 0,
        gameplayCompletionist: entry.comp_100 > 0 ? Math.round(entry.comp_100 / 3600) : 0,
        url: `${HLTB_BASE_URL}/game/${entry.game_id}`,
      };
    } catch (error) {
      hltbLogger.debug({ error, title }, "HLTB lookup failed");
      return undefined;
    }
  }
}

export const hltbClient = new HLTBClient();

const router = Router();

router.get("/api/hltb/lookup", authenticateToken, async (req, res) => {
  const rawTitle = req.query.title;
  if (typeof rawTitle !== "string" || !rawTitle.trim() || rawTitle.length > 200) {
    return res
      .status(400)
      .json({ error: "title must be a non-empty string of 200 characters or fewer" });
  }

  const data = await hltbClient.lookup(rawTitle.trim());
  return res.json({ data });
});

export const hltbRouter = router;
