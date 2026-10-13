import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiSelect } from "@/components/ui/multi-select";

describe("MultiSelect localized content", () => {
  it("marks its trigger, search field, and empty state with the translated language and direction", () => {
    render(
      <MultiSelect
        options={[]}
        selected={[]}
        onChange={vi.fn()}
        placeholder="اختر المجموعات..."
        lang="ar"
        dir="rtl"
        searchPlaceholder="بحث..."
        searchLang="ar"
        searchDir="rtl"
        emptyMessage="لم يتم العثور على عناصر."
        emptyLang="ar"
        emptyDir="rtl"
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("lang", "ar");
    expect(trigger).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("اختر المجموعات...")).toHaveAttribute("dir", "rtl");

    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText("بحث...");
    expect(searchInput).toHaveAttribute("lang", "ar");
    expect(searchInput).toHaveAttribute("dir", "rtl");
    const popover = screen.getByRole("dialog");
    expect(popover).toHaveAttribute("dir", "rtl");
    expect(popover.querySelector("[cmdk-root]")).toHaveAttribute("dir", "rtl");

    fireEvent.change(searchInput, { target: { value: "FitGirl" } });
    expect(searchInput).toHaveAttribute("lang", "und");
    expect(searchInput).toHaveAttribute("dir", "auto");
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(searchInput).toHaveAttribute("lang", "ar");
    expect(searchInput).toHaveAttribute("dir", "rtl");

    const emptyState = screen.getByText("لم يتم العثور على عناصر.");
    expect(emptyState).toHaveAttribute("lang", "ar");
    expect(emptyState).toHaveAttribute("dir", "rtl");
  });

  it("keeps upstream option values auto-directed inside translated RTL controls", () => {
    render(
      <MultiSelect
        options={[{ value: "FitGirl", label: "FitGirl" }]}
        selected={["FitGirl"]}
        onChange={vi.fn()}
        placeholder="اختر المجموعات..."
        lang="ar"
        dir="rtl"
        searchPlaceholder="بحث..."
        searchLang="ar"
        searchDir="rtl"
        emptyMessage="لم يتم العثور على عناصر."
        emptyLang="ar"
        emptyDir="rtl"
      />
    );

    const selectedValue = screen.getByText("FitGirl", { exact: true });
    expect(selectedValue).toHaveAttribute("lang", "und");
    expect(selectedValue).toHaveAttribute("dir", "auto");

    fireEvent.click(screen.getByRole("combobox"));
    const optionValue = screen.getByRole("option", { name: "FitGirl" }).querySelector("span");
    expect(optionValue).toHaveTextContent("FitGirl");
    expect(optionValue).toHaveAttribute("lang", "und");
    expect(optionValue).toHaveAttribute("dir", "auto");
  });

  it("marks remove actions and upstream labels with their own language metadata", () => {
    render(
      <MultiSelect
        options={[{ value: "FitGirl", label: "FitGirl" }]}
        selected={["FitGirl"]}
        onChange={vi.fn()}
        placeholder="اختر المجموعات..."
        lang="ar"
        dir="rtl"
        removeLabel={(label) => `إزالة ${label}`}
        removeLang="ar"
        removeDir="rtl"
      />
    );

    const removeButton = screen.getByRole("button", { name: "إزالة FitGirl" });
    const labelIds = removeButton.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];
    expect(labelIds).toHaveLength(2);
    const [actionId, optionId] = labelIds;
    if (!actionId || !optionId) throw new Error("Expected action and option label references");
    const action = document.getElementById(actionId);
    const option = document.getElementById(optionId);
    expect(action).toHaveTextContent("إزالة");
    expect(action).toHaveAttribute("lang", "ar");
    expect(action).toHaveAttribute("dir", "rtl");
    expect(option).toHaveTextContent("FitGirl");
    expect(option).toHaveAttribute("lang", "und");
    expect(option).toHaveAttribute("dir", "auto");
  });
});
