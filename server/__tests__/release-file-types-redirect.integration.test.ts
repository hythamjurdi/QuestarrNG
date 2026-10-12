import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SearchItem } from "../search.js";
import type { Indexer } from "../../shared/schema.js";
import { filterReleaseFileTypes } from "../release-file-types.js";

function torrent(name: string) {
  return Buffer.from(
    `d4:infod6:lengthi1e4:name${Buffer.byteLength(name)}:${name}12:piece lengthi16384e6:pieces20:${"a".repeat(20)}ee`
  );
}

describe("verified file-type filtering with redirected indexer downloads", () => {
  let server: Server;
  let origin = "";
  const requests: string[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      requests.push(request.url ?? "");
      if (request.url === "/resolve?apikey=test-key") {
        response.writeHead(302, { location: "/files/example.torrent" }).end();
      } else if (request.url === "/files/example.torrent") {
        response
          .writeHead(200, { "content-type": "application/x-bittorrent" })
          .end(torrent("Example.NSP"));
      } else {
        response.writeHead(404).end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Local test server did not bind");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  });

  it("follows a same-origin redirect and verifies the final torrent manifest", async () => {
    const result = await filterReleaseFileTypes(
      [
        {
          title: "Example Switch release",
          link: `${origin}/resolve?apikey=test-key`,
          pubDate: "",
          indexerId: "local",
          indexerName: "Local test indexer",
          category: [],
          guid: "example",
          downloadType: "torrent",
        } satisfies SearchItem,
      ],
      ["nsp"],
      [
        {
          id: "local",
          url: origin,
          allowInsecureLan: true,
        } as Indexer,
      ]
    );

    expect(result).toHaveLength(1);
    expect(requests).toEqual(["/resolve?apikey=test-key", "/files/example.torrent"]);
  });
});
