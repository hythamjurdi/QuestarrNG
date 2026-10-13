// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  redactSnapshot,
  stableSnapshotStringify,
} from "./upstream-source-redaction.mjs";

describe("upstream source snapshot redaction", () => {
  it("redacts signed guest-share tokens while preserving the rest of the URL", () => {
    const source = {
      body: '<a href="https://huly.app/guest/project?token=signed-value&view=read-only">details</a>',
    };

    expect(redactSnapshot(source)).toEqual({
      body: '<a href="https://huly.app/guest/project?token=[redacted]&view=read-only">details</a>',
    });
  });

  it("redacts sensitive query parameters case-insensitively in nested values", () => {
    expect(
      redactSnapshot({
        comments: [
          "https://example.test/path?ACCESS_TOKEN=alpha&next=page",
          "https://example.test/path?api_key=beta",
          "https://example.test/path?client_secret=gamma",
          "https://example.test/path?password=delta",
          "https://example.test/path?jwt=epsilon",
          "https://example.test/path?X-Amz-Signature=zeta",
        ],
      })
    ).toEqual({
      comments: [
        "https://example.test/path?ACCESS_TOKEN=[redacted]&next=page",
        "https://example.test/path?api_key=[redacted]",
        "https://example.test/path?client_secret=[redacted]",
        "https://example.test/path?password=[redacted]",
        "https://example.test/path?jwt=[redacted]",
        "https://example.test/path?X-Amz-Signature=[redacted]",
      ],
    });
  });

  it("redacts database connection strings and is idempotent", () => {
    const source = {
      details: "postgres://user:secret@db.example.test:5432/questarr",
      nested: ["https://example.test/path?token=secret"],
    };

    const redacted = redactSnapshot(source);

    expect(redacted).toEqual({
      details: "[redacted database connection string]",
      nested: ["https://example.test/path?token=[redacted]"],
    });
    expect(redactSnapshot(redacted)).toEqual(redacted);
    const markdownTick = String.fromCharCode(96);
    const wrappedConnection =
      "DATABASE_URL=" +
      markdownTick +
      "postgres://user:secret@db.example.test:5432/questarr" +
      markdownTick;
    expect(redactSnapshot(wrappedConnection)).toBe(
      "DATABASE_URL=" +
        markdownTick +
        "[redacted database connection string]" +
        markdownTick
    );
  });

  it("serializes object keys in a stable order for source digests", () => {
    const first = { z: { b: 2, a: 1 }, a: [3, { y: 5, x: 4 }] };
    const reordered = { a: [3, { x: 4, y: 5 }], z: { a: 1, b: 2 } };

    expect(stableSnapshotStringify(first)).toBe(stableSnapshotStringify(reordered));
  });
});
