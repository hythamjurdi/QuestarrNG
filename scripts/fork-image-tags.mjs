import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function getForkImageTags({ image, ref, refName, sha }) {
  const tags = [`${image}:sha-${sha}`];

  if (ref.startsWith("refs/tags/v")) {
    tags.push(`${image}:${refName.slice(1)}`, `${image}:latest`);
  } else if (ref === "refs/heads/main") {
    tags.push(`${image}:dev`);
  } else {
    throw new Error(`Unsupported image publishing ref: ${ref}`);
  }

  return tags;
}

function main(args) {
  const [image, ref, refName, sha, outputFile] = args;
  if (!image || !ref || !refName || !sha || !outputFile) {
    throw new Error("Expected image, ref, ref name, commit SHA, and GitHub output path");
  }

  const tags = getForkImageTags({ image, ref, refName, sha });
  appendFileSync(outputFile, `tags<<EOF\n${tags.join("\n")}\nEOF\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
