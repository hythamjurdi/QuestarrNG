import { describe, expect, it } from "vitest";
import { getForkImageReleaseTag, getForkImageTags } from "../fork-image-tags.mjs";

describe("fork image tags", () => {
  const image = "ghcr.io/snapetech/questarrng";
  const sha = "a1b2c3d4";

  it("publishes only the immutable commit tag before scans for main builds", () => {
    expect(getForkImageTags({ image, ref: "refs/heads/main", refName: "main", sha })).toEqual([
      `${image}:sha-${sha}`,
    ]);
    expect(getForkImageReleaseTag("refs/heads/main", "main")).toBe("dev");
  });

  it("publishes only the immutable commit tag before scans for versioned releases", () => {
    expect(getForkImageTags({ image, ref: "refs/tags/v1.10.0", refName: "v1.10.0", sha })).toEqual([
      `${image}:sha-${sha}`,
    ]);
    expect(getForkImageReleaseTag("refs/tags/v1.10.0", "v1.10.0")).toBe("1.10.0");
  });

  it("rejects refs outside the configured main and version-tag triggers", () => {
    expect(() =>
      getForkImageTags({ image, ref: "refs/heads/feature", refName: "feature", sha })
    ).toThrow("Unsupported image publishing ref");
    expect(() => getForkImageReleaseTag("refs/heads/feature", "feature")).toThrow(
      "Unsupported image publishing ref"
    );
  });
});
