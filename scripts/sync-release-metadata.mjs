import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const [version, image, digest] = process.argv.slice(2);

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Release version must use MAJOR.MINOR.PATCH.");
}
if (image !== "ghcr.io/snapetech-org/questarrng") {
  throw new Error("Unexpected Home Assistant base image repository.");
}
if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? "")) {
  throw new Error("Release image digest is invalid.");
}

const path = "questarr/Dockerfile";
const contents = await readFile(path, "utf8");
const lines = contents.trimEnd().split("\n");
const pinnedImage =
  /^ARG QUESTARR_IMAGE=ghcr\.io\/snapetech-org\/questarrng:\d+\.\d+\.\d+@sha256:[a-f0-9]{64}$/;
const matches = lines.flatMap((line, index) => (pinnedImage.test(line) ? [index] : []));

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one pinned Home Assistant base image; found ${matches.length}.`
  );
}

lines[matches[0]] = `ARG QUESTARR_IMAGE=${image}:${version}@${digest}`;
await writeFile(path, `${lines.join("\n")}\n`);
