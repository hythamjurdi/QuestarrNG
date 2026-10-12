import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiSelect } from "../src/components/ui/multi-select";

describe("MultiSelect", () => {
  it("removes a selected option without nesting the remove control in the trigger", () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        options={[{ label: "Games", value: "games" }]}
        selected={["games"]}
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("combobox");
    const removeButton = screen.getByRole("button", { name: "Remove Games" });
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
    expect(removeButton.parentElement?.closest("button")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
