import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "server/routes.ts",
  "server/game-journal-routes.ts",
  "server/routes/api-keys.ts",
  "server/routes/import.ts",
  "server/routes/integration.ts",
  "server/steam-routes.ts",
];

// These middleware exports are legacy names retained at their call sites, but
// each now delegates body validation to validate(zodSchema).
const zodBodySanitizers = new Set([
  "sanitizeGameStatus",
  "sanitizeGameData",
  "sanitizeIndexerData",
  "sanitizeIndexerUpdateData",
  "sanitizeDownloaderData",
  "sanitizeDownloaderTestData",
  "sanitizeProwlarrSyncData",
  "sanitizeDownloaderUpdateData",
  "sanitizeDownloaderDownloadData",
  "sanitizeMatchAndAddTitle",
  "sanitizeRootFolderData",
  "sanitizeRootFolderUpdateData",
  "sanitizeLibraryScanData",
  "sanitizeUnmatchedMatchData",
  "sanitizeUnmatchedSearchData",
  "gameFileBodyValidation",
]);

function hasRequestBodyAccess(callback: ts.ArrowFunction | ts.FunctionExpression): boolean {
  const requestParam = callback.parameters[0]?.name;
  if (!requestParam || !ts.isIdentifier(requestParam)) return false;
  let usesBody = false;

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "body" &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === requestParam.text
    ) {
      usesBody = true;
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(callback.body, visit);
  return usesBody;
}

function hasZodBodyValidation(node: ts.Expression): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "validate"
  ) {
    return true;
  }
  if (ts.isIdentifier(node) && zodBodySanitizers.has(node.text)) return true;
  return false;
}

describe("mutation request body validation contract", () => {
  it("validates every body-consuming POST, PATCH, and PUT with Zod middleware", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ["post", "patch", "put"].includes(node.expression.name.text)
        ) {
          const callbacks = node.arguments.filter(
            (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
              ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
          );
          const consumesBody = callbacks.some(hasRequestBodyAccess);
          const hasValidation = node.arguments.slice(1).some(hasZodBodyValidation);

          if (consumesBody && !hasValidation) {
            const line =
              sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            const method = node.expression.name.text.toUpperCase();
            const route = ts.isStringLiteral(node.arguments[0])
              ? node.arguments[0].text
              : "<dynamic>";
            violations.push(`${file}:${line} ${method} ${route}`);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });
});
