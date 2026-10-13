import { describe, expect, it } from "vitest";
import { getForkImageTags } from "../fork-image-tags.mjs";

describe("fork image tags", () => {
  const image = "ghcr.io/snapetech/questarrng";
  const sha = "a1b2c3d4";

  it("publishes main builds to the dev and immutable commit tags", () => {
    expect(getForkImageTags({ image, ref: "refs/heads/main", refName: "main", sha })).toEqual([
      `${image}:sha-${sha}`,
      `${image}:dev`,
    ]);
  });

  it("publishes versioned releases to latest, semantic-version, and immutable commit tags", () => {
    expect(getForkImageTags({ image, ref: "refs/tags/v1.10.0", refName: "v1.10.0", sha })).toEqual([
      `${image}:sha-${sha}`,
      `${image}:1.10.0`,
      `${image}:latest`,
    ]);
  });

  it("rejects refs outside the configured main and version-tag triggers", () => {
    expect(() =>
      getForkImageTags({ image, ref: "refs/heads/feature", refName: "feature", sha })
    ).toThrow("Unsupported image publishing ref");
  });
});
