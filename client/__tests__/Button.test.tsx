import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button form behavior", () => {
  it("does not submit a form by default and still submits when requested", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <Button onClick={onClick}>Show options</Button>
        <Button type="submit">Save settings</Button>
      </form>
    );

    const optionsButton = screen.getByRole("button", { name: "Show options" });
    expect(optionsButton.getAttribute("type")).toBe("button");
    fireEvent.click(optionsButton);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not add a button type to an asChild link", () => {
    render(
      <Button asChild>
        <a href="/library">Open library</a>
      </Button>
    );

    expect(screen.getByRole("link", { name: "Open library" }).getAttribute("type")).toBeNull();
  });
});
