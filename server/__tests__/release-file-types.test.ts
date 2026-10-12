import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchItem } from "../search.js";
import type { Indexer } from "../../shared/schema.js";
const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock("../ssrf.js", () => ({ safeFetch }));
import { filterReleaseFileTypes } from "../release-file-types.js";

function torrent(name: string) {
  return Buffer.from(
    `d4:infod6:lengthi1e4:name${Buffer.byteLength(name)}:${name}12:piece lengthi16384e6:pieces20:${"a".repeat(20)}ee`
  );
}
const item = (overrides: Partial<SearchItem> = {}): SearchItem => ({
  title: "Example NSP release",
  link: "https://indexer.example/game.torrent",
  pubDate: "",
  indexerId: "indexer",
  indexerName: "Source",
  category: [],
  guid: "release",
  downloadType: "torrent",
  ...overrides,
});
describe("verified torrent file types", () => {
  beforeEach(() => safeFetch.mockReset());
  it("parses the actual torrent manifest rather than trusting the release title", async () => {
    safeFetch.mockResolvedValueOnce(new Response(torrent("Game.NSP")));
    expect(await filterReleaseFileTypes([item()], ["nsp"], [])).toHaveLength(1);
    safeFetch.mockResolvedValueOnce(new Response(torrent("Game.exe")));
    expect(await filterReleaseFileTypes([item()], ["nsp"], [])).toEqual([]);
  });
  it("excludes magnets and Usenet whose payloads cannot be inspected", async () => {
    expect(
      await filterReleaseFileTypes(
        [item({ link: "magnet:?xt=urn:btih:" + "a".repeat(40) }), item({ downloadType: "usenet" })],
        ["nsp"],
        []
      )
    ).toEqual([]);
    expect(safeFetch).not.toHaveBeenCalled();
  });
  it("excludes malformed, oversized, redirected and unavailable metadata", async () => {
    for (const response of [
      new Response("bad"),
      new Response(new Uint8Array(2 * 1024 * 1024 + 1)),
      new Response(null, { status: 302 }),
      new Response("missing", { status: 404 }),
    ]) {
      safeFetch.mockResolvedValueOnce(response);
      expect(await filterReleaseFileTypes([item()], ["nsp"], [])).toEqual([]);
    }
    safeFetch.mockRejectedValueOnce(new Error("timeout"));
    expect(await filterReleaseFileTypes([item()], ["nsp"], [])).toEqual([]);
  });
  it("requires explicit source consent for HTTP and never forwards URL credentials through redirects", async () => {
    const release = item({ link: "http://indexer.example/game.torrent?apikey=example" });
    const indexer = {
      id: "indexer",
      url: "http://indexer.example",
      allowInsecureLan: false,
    } as Indexer;
    expect(await filterReleaseFileTypes([release], ["nsp"], [indexer])).toEqual([]);
    expect(safeFetch).not.toHaveBeenCalled();
    safeFetch.mockResolvedValueOnce(new Response(torrent("game.nsp")));
    expect(
      await filterReleaseFileTypes([release], ["nsp"], [{ ...indexer, allowInsecureLan: true }])
    ).toHaveLength(1);
    expect(safeFetch).toHaveBeenCalledWith(
      release.link,
      expect.objectContaining({ redirect: "manual", allowPrivate: true })
    );
  });
  it("bounds external work to twenty candidates", async () => {
    safeFetch.mockImplementation(async () => new Response(torrent("game.nsp")));
    expect(
      await filterReleaseFileTypes(
        Array.from({ length: 25 }, () => item()),
        ["nsp"],
        []
      )
    ).toHaveLength(20);
    expect(safeFetch).toHaveBeenCalledTimes(20);
  });
});
