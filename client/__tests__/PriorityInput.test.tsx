/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { PriorityInput } from "../src/components/PriorityInput";

describe("PriorityInput", () => {
  it("keeps an empty draft editable until the user enters a replacement value", () => {
    const onSave = vi.fn();
    render(<PriorityInput id="indexer-1" priority={3} onSave={onSave} />);
    const input = screen.getByRole("spinbutton", { name: "Priority value" });

    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(null);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "42" } });
    expect(input).toHaveValue(42);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith("indexer-1", 42);
    expect(input).toHaveValue(42);
  });

  it("clamps saved values to the supported priority range", () => {
    const onSave = vi.fn();
    render(<PriorityInput id="downloader-1" priority={4} onSave={onSave} />);
    const input = screen.getByRole("spinbutton", { name: "Priority value" });

    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledWith("downloader-1", 100);
    expect(input).toHaveValue(100);
  });
});
