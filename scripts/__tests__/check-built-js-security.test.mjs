import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { load } from "js-yaml";
import { findDangerousJavaScript } from "../check-built-js-security.mjs";

describe("production JavaScript security check", () => {
  it("allows ordinary eval-named methods used by regex libraries", () => {
    const source = `
      class RegexCompiler {
        eval(pattern) { return this.compile(pattern); }
        run(pattern) { return this.eval(pattern); }
      }
      new RegexCompiler().eval("^Questarr$");
    `;

    expect(findDangerousJavaScript(source)).toEqual([]);
  });

  it("rejects direct and browser-global dynamic eval calls", () => {
    const source = `
      eval(userInput);
      window["eval"](otherInput);
      globalThis.eval(thirdInput);
    `;

    expect(findDangerousJavaScript(source).map(({ description }) => description)).toEqual([
      "global eval()",
      "global eval()",
      "global eval()",
    ]);
  });

  it("rejects aliases of the global eval function", () => {
    const source = `
      const execute = eval;
      const browserEval = window.eval;
      execute(userInput);
      browserEval(otherInput);
    `;

    expect(findDangerousJavaScript(source).map(({ description }) => description)).toEqual([
      "global eval reference",
      "global eval reference",
    ]);
  });

  it("rejects calls to the dangerous Angular functions used by ZAP 10110", () => {
    const source = `
      $scope.$eval(expression);
      $sce.bypassSecurityTrustHtml(value);
      trustAsHtml(value);
    `;

    expect(findDangerousJavaScript(source).map(({ description }) => description)).toEqual([
      "Angular sanitizer bypass / expression evaluation: $eval",
      "Angular sanitizer bypass / expression evaluation: bypassSecurityTrustHtml",
      "Angular sanitizer bypass / expression evaluation: trustAsHtml",
    ]);
  });

  it("rejects aliases of dangerous Angular sanitizer bypass functions", () => {
    const source = `const unsafe = $sce.bypassSecurityTrustHtml;`;

    expect(findDangerousJavaScript(source).map(({ description }) => description)).toEqual([
      "Angular sanitizer bypass / expression evaluation reference: bypassSecurityTrustHtml",
    ]);
  });

  it("fails closed when a JavaScript bundle cannot be parsed", () => {
    expect(findDangerousJavaScript("function {")[0].description).toMatch(/JavaScript parse error/);
  });

  it("runs the syntax check before the production server and records ZAP's text-only override", () => {
    const workflow = load(readFileSync(resolve(cwd(), ".github/workflows/dast.yml"), "utf8"));
    const steps = workflow.jobs["zap-baseline"].steps;
    const buildIndex = steps.findIndex((step) => step.name === "Build project");
    const guardIndex = steps.findIndex((step) =>
      step.run?.includes("scripts/check-built-js-security.mjs")
    );
    const serverIndex = steps.findIndex((step) => step.name === "Start server");

    expect(guardIndex).toBeGreaterThan(buildIndex);
    expect(guardIndex).toBeLessThan(serverIndex);

    const ruleRows = readFileSync(resolve(cwd(), ".zap/rules.tsv"), "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("\t"));
    const dangerousFunctions = ruleRows.filter(([ruleId]) => ruleId === "10110");
    expect(dangerousFunctions).toHaveLength(1);
    expect(dangerousFunctions[0][1]).toBe("IGNORE");
    expect(dangerousFunctions[0][2]).toContain("scripts/check-built-js-security.mjs");
  });
});
