import path from "node:path";
import parseTorrent from "parse-torrent";
import type { SearchItem } from "./search.js";
import type { Indexer } from "../shared/schema.js";
import { safeFetch } from "./ssrf.js";

/** Strict manifest filter: unknown payloads never pass by guessing from a release title. */
export async function filterReleaseFileTypes(
  items: SearchItem[],
  extensions: string[],
  indexers: Indexer[]
) {
  const allowed = new Set(
    extensions.map((extension) => `.${extension.toLowerCase().replace(/^\./, "")}`)
  );
  const sources = new Map(indexers.map((indexer) => [indexer.id, indexer]));
  const accepted: SearchItem[] = [];
  // Bound external work per page; callers request 20 results when this filter is enabled.
  const candidates = items.slice(0, 20);
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = await Promise.all(
      candidates.slice(offset, offset + 4).map(async (item) => {
        if (item.downloadType !== "torrent") return false;
        try {
          const url = new URL(item.link);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
            return false;
          const source = sources.get(item.indexerId);
          const sameOrigin = source && new URL(source.url).origin === url.origin;
          if (url.protocol === "http:" && !(sameOrigin && source.allowInsecureLan)) return false;
          const response = await safeFetch(url.href, {
            allowPrivate: Boolean(sameOrigin),
            requireHttps: url.protocol === "https:",
            // safeFetch validates every redirect hop, strips credential headers across
            // origins, and pins HTTPS credential-bearing requests to their source origin.
            redirect: "follow",
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok || !response.body) {
            await response.body?.cancel();
            return false;
          }
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.length;
              if (size > 2 * 1024 * 1024) return false;
              chunks.push(value);
            }
          } finally {
            await reader.cancel();
          }
          const torrent = await parseTorrent(Buffer.concat(chunks));
          return Boolean(
            torrent.files?.length &&
            torrent.files.every((file) =>
              allowed.has(path.posix.extname(file.path.replaceAll("\\", "/")).toLowerCase())
            )
          );
        } catch {
          return false;
        }
      })
    );
    batch.forEach((matches, index) => {
      if (matches) accepted.push(candidates[offset + index]!);
    });
  }
  return accepted;
}
