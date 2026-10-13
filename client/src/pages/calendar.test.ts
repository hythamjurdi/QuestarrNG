import { beforeEach, describe, expect, it } from "vitest";
import { getDaysInMonth, getWeekDays, formatDate } from "./calendar";
import { setRegionalPreference } from "@/lib/regional-format";

describe("calendar locale week structure", () => {
  beforeEach(() => {
    localStorage.clear();
    setRegionalPreference("system");
  });

  it("starts the week view on the selected locale's first weekday", () => {
    setRegionalPreference("ja");

    expect(getWeekDays(new Date(2024, 0, 10)).map(formatDate)).toEqual([
      "2024-01-07",
      "2024-01-08",
      "2024-01-09",
      "2024-01-10",
      "2024-01-11",
      "2024-01-12",
      "2024-01-13",
    ]);
  });

  it("aligns the month grid and its trailing days to a Sunday-first locale", () => {
    setRegionalPreference("pt-BR");
    const days = getDaysInMonth(2024, 0);

    expect(formatDate(days[0]!)).toBe("2023-12-31");
    expect(formatDate(days.at(-1)!)).toBe("2024-02-03");
    expect(days).toHaveLength(35);
  });

  it("fills complete weeks for an explicit Saturday start", () => {
    const days = getDaysInMonth(2024, 3, 6);

    expect(days[0]!.getDay()).toBe(6);
    expect(days.at(-1)!.getDay()).toBe(5);
    expect(days.filter((day) => day.getMonth() === 3)).toHaveLength(30);
  });
});
