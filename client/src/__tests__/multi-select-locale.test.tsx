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

    const emptyState = screen.getByText("لم يتم العثور على عناصر.");
    expect(emptyState).toHaveAttribute("lang", "ar");
    expect(emptyState).toHaveAttribute("dir", "rtl");
  });
});
