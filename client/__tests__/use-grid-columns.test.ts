/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useGridColumns } from "../src/hooks/use-grid-columns";

describe("useGridColumns", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses five columns by default and persists a changed value", () => {
    const { result } = renderHook(() => useGridColumns("wishlistGridColumns"));

    expect(result.current.gridColumns).toBe(5);
    act(() => result.current.handleGridColumnsChange([8]));

    expect(result.current.gridColumns).toBe(8);
    expect(localStorage.getItem("wishlistGridColumns")).toBe("8");
  });

  it("clamps a saved out-of-range value and writes the safe value back", () => {
    localStorage.setItem("wishlistGridColumns", "11");

    const { result } = renderHook(() => useGridColumns("wishlistGridColumns"));

    expect(result.current.gridColumns).toBe(10);
    expect(localStorage.getItem("wishlistGridColumns")).toBe("10");
  });

  it("rounds and clamps fractional values to the supported range", () => {
    localStorage.setItem("wishlistGridColumns", "1.5");
    const { result } = renderHook(() => useGridColumns("wishlistGridColumns"));

    expect(result.current.gridColumns).toBe(2);
    expect(localStorage.getItem("wishlistGridColumns")).toBe("2");

    act(() => result.current.handleGridColumnsChange([0]));
    expect(result.current.gridColumns).toBe(2);
    expect(localStorage.getItem("wishlistGridColumns")).toBe("2");
  });

  it("falls back to five when the saved value is not finite", () => {
    localStorage.setItem("wishlistGridColumns", "Infinity");

    const { result } = renderHook(() => useGridColumns("wishlistGridColumns"));

    expect(result.current.gridColumns).toBe(5);
    expect(localStorage.getItem("wishlistGridColumns")).toBe("5");
  });
});
