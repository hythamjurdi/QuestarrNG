import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { UI_LABELS } from "@/lib/ui-labels";

const CLIENT_SOURCE_ROOT = resolve(process.cwd(), "client/src");

// These are provider/protocol names rather than interface copy, so they stay in
// their original form in every locale.
const INTENTIONALLY_UNTRANSLATED_SOURCE_KEYS = new Set(["RAWG", "Torznab"]);

function sourceFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return sourceFilesIn(path);
    }
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\.[^.]+$/.test(entry.name)
      ? [path]
      : [];
  });
}

function messageKeys(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node)) {
    return [...messageKeys(node.whenTrue), ...messageKeys(node.whenFalse)];
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return messageKeys(node.expression);
  }
  return [];
}

function interfaceSourceKeys(): Set<string> {
  const keys = new Set<string>();

  for (const path of sourceFilesIn(CLIENT_SOURCE_ROOT)) {
    const text = readFileSync(path, "utf8");
    const sourceFile = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const hasInterfaceLanguageHook = text.includes("useInterfaceLanguage");

    const collect = (value: string) => keys.add(value);
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (node.tagName.getText(sourceFile) === "InterfaceText") {
          for (const attribute of node.attributes.properties) {
            if (!ts.isJsxAttribute(attribute) || attribute.name.getText(sourceFile) !== "source") {
              continue;
            }
            if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
              collect(attribute.initializer.text);
            } else if (
              attribute.initializer &&
              ts.isJsxExpression(attribute.initializer) &&
              attribute.initializer.expression
            ) {
              messageKeys(attribute.initializer.expression).forEach(collect);
            }
          }
        }
      }

      if (ts.isCallExpression(node) && node.arguments[0]) {
        const callee = node.expression.getText(sourceFile);
        if (
          callee === "formatInterfaceMessage" ||
          callee === "translateInterfaceLabel" ||
          (callee === "t" && hasInterfaceLanguageHook)
        ) {
          messageKeys(node.arguments[0]).forEach(collect);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return keys;
}

describe("interface source coverage", () => {
  it("catalogs every fixed interface string reference", () => {
    const uncatalogued = [...interfaceSourceKeys()].filter(
      (source) =>
        !Object.hasOwn(UI_LABELS, source) && !INTENTIONALLY_UNTRANSLATED_SOURCE_KEYS.has(source)
    );

    expect(uncatalogued).toEqual([]);
  });
});
