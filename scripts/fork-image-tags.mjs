import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function getForkImageTags({ image, ref, refName, sha }) {
  getForkImageReleaseTag(ref, refName);
  return [`${image}:sha-${sha}`];
}

export function getForkImageReleaseTag(ref, refName) {
  if (ref.startsWith("refs/tags/v")) {
    return refName.slice(1);
  }
  if (ref === "refs/heads/main") return "dev";

  throw new Error(`Unsupported image publishing ref: ${ref}`);
}

function main(args) {
  const [image, ref, refName, sha, outputFile] = args;
  if (!image || !ref || !refName || !sha || !outputFile) {
    throw new Error("Expected image, ref, ref name, commit SHA, and GitHub output path");
  }

  const releaseTag = getForkImageReleaseTag(ref, refName);
  const tags = getForkImageTags({ image, ref, refName, sha });
  appendFileSync(outputFile, `tags<<EOF\n${tags.join("\n")}\nEOF\n`);
  appendFileSync(outputFile, `release_tag=${releaseTag}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
