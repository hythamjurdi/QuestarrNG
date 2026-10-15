#!/usr/bin/env node
/* global console, process */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const GLOBAL_OBJECTS = new Set(["globalThis", "self", "window"]);
const ANGULAR_DANGEROUS_FUNCTIONS = new Set([
  "$eval",
  "$evalAsync",
  "bypassSecurityTrustHtml",
  "bypassSecurityTrustResourceUrl",
  "bypassSecurityTrustScript",
  "bypassSecurityTrustStyle",
  "bypassSecurityTrustUrl",
  "trustAsHtml",
]);

function staticMemberName(expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }
  return undefined;
}

function isGlobalProperty(expression, propertyName) {
  return (
    staticMemberName(expression) === propertyName &&
    ts.isIdentifier(expression.expression) &&
    GLOBAL_OBJECTS.has(expression.expression.text)
  );
}

function diagnosticForCall(expression) {
  if (ts.isIdentifier(expression) && expression.text === "eval") {
    return "global eval()";
  }
  if (isGlobalProperty(expression, "eval")) return "global eval()";
  if (
    (ts.isIdentifier(expression) ||
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
    ANGULAR_DANGEROUS_FUNCTIONS.has(
      ts.isIdentifier(expression) ? expression.text : staticMemberName(expression)
    )
  ) {
    return (
      "Angular sanitizer bypass / expression evaluation: " +
      (ts.isIdentifier(expression) ? expression.text : staticMemberName(expression))
    );
  }
  return undefined;
}

function isCallee(node) {
  const parent = node.parent;
  return (ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.expression === node;
}

function isDeclarationName(node) {
  const parent = node.parent;
  return (
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isMethodSignature(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isFunctionExpression(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node)
  );
}

function diagnosticForReference(node) {
  if (isCallee(node)) return undefined;
  if (isDeclarationName(node)) return undefined;

  if (ts.isIdentifier(node)) {
    if (node.text === "eval") return "global eval reference";
    if (ANGULAR_DANGEROUS_FUNCTIONS.has(node.text)) {
      return "Angular sanitizer bypass / expression evaluation reference: " + node.text;
    }
  }
  if (isGlobalProperty(node, "eval")) return "global eval reference";
  if (ANGULAR_DANGEROUS_FUNCTIONS.has(staticMemberName(node))) {
    return "Angular sanitizer bypass / expression evaluation reference: " + staticMemberName(node);
  }
  return undefined;
}

export function findDangerousJavaScript(source, fileName = "<source>") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const findings = [];
  const record = (node, description) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      description,
      fileName,
      line: line + 1,
      column: character + 1,
    });
  };
  for (const diagnostic of sourceFile.parseDiagnostics) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    findings.push({
      description:
        "JavaScript parse error: " + ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      fileName,
      line: line + 1,
      column: character + 1,
    });
  }
  const walk = (node) => {
    if (ts.isCallExpression(node)) {
      const description = diagnosticForCall(node.expression);
      if (description) record(node, description);
    } else if (ts.isNewExpression(node)) {
      const description = diagnosticForCall(node.expression);
      if (description) record(node, description);
    }
    if (
      ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      const description = diagnosticForReference(node);
      if (description) record(node, description);
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  return findings;
}

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(fullPath);
    if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) return [fullPath];
    return [];
  });
}

function checkDirectory(directory) {
  if (!statSync(directory).isDirectory()) {
    throw new Error(
      "Expected a directory containing the production JavaScript bundles: " + directory
    );
  }
  const files = collectJavaScriptFiles(directory);
  if (files.length === 0) {
    throw new Error("No production JavaScript bundles found in " + directory);
  }

  const findings = files.flatMap((fileName) =>
    findDangerousJavaScript(readFileSync(fileName, "utf8"), fileName)
  );
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(
        finding.fileName + ":" + finding.line + ":" + finding.column + ": " + finding.description
      );
    }
    throw new Error(
      "Found " + findings.length + " dangerous JavaScript call(s) in production bundles."
    );
  }
  console.log(
    "Checked " + files.length + " production JavaScript bundle(s); no dangerous calls found."
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkDirectory(path.resolve(process.argv[2] ?? "dist/public/assets"));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
