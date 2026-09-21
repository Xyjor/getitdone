import { describe, expect, it } from "vitest";
import { safeNext } from "@/components/auth/auth-form";
import { formatDueDate, initials } from "@/lib/ui";

describe("formatDueDate", () => {
  const today = "2026-09-21"; // a Monday

  it.each([
    ["2026-09-21", "Today", "today"],
    ["2026-09-22", "Tomorrow", "soon"],
    ["2026-09-20", "Yesterday", "overdue"],
    ["2026-09-10", "Sep 10", "overdue"],
    ["2026-09-24", "Thursday", "soon"],
    ["2026-10-15", "Oct 15", "later"],
  ])("%s -> %s", (date, label, tone) => {
    expect(formatDueDate(date, today)).toEqual({ label, tone });
  });
});

describe("initials", () => {
  it("uses up to two words", () => {
    expect(initials("Ada Lovelace King")).toBe("AL");
    expect(initials("cher")).toBe("C");
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/app/lists/1")).toBe("/app/lists/1");
    expect(safeNext("https://evil.example")).toBe("/app");
    expect(safeNext("//evil.example")).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
  });
});
