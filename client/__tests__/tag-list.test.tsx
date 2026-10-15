/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom";

import { TagList } from "../src/components/ui/tag-list";

describe("TagList", () => {
  it("renders nothing when items is empty and no emptyText provided", () => {
    const { container } = render(<TagList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders emptyText when items is empty and emptyText is provided", () => {
    render(<TagList items={[]} emptyText="No genres" />);
    expect(screen.getByText("No genres")).toBeInTheDocument();
  });

  it("renders all items when count is within maxVisible", () => {
    render(<TagList items={["Action", "RPG"]} maxVisible={3} />);
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it("shows overflow trigger when items exceed maxVisible", () => {
    render(<TagList items={["Action", "RPG", "Strategy", "Puzzle"]} maxVisible={2} />);
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.queryByText("Strategy")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 2 more items" })).toBeInTheDocument();
  });

  it("reveals hidden items in popover when overflow trigger is clicked", () => {
    render(<TagList items={["Action", "RPG", "Strategy", "Puzzle"]} maxVisible={2} />);
    const trigger = screen.getByRole("button", { name: "Show 2 more items" });
    fireEvent.click(trigger);
    expect(screen.getByText("Strategy")).toBeInTheDocument();
    expect(screen.getByText("Puzzle")).toBeInTheDocument();
  });

  it("applies getTestId to visible badges", () => {
    render(<TagList items={["Action"]} getTestId={(g) => `badge-genre-${g.toLowerCase()}`} />);
    expect(screen.getByTestId("badge-genre-action")).toBeInTheDocument();
  });

  it("applies getTestId to overflow badges after opening the popover", () => {
    render(
      <TagList
        items={["Action", "RPG", "Strategy"]}
        maxVisible={1}
        getTestId={(genre) => `badge-genre-${genre.toLowerCase()}`}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more items" }));

    expect(screen.getByTestId("badge-genre-rpg")).toBeInTheDocument();
    expect(screen.getByTestId("badge-genre-strategy")).toBeInTheDocument();
  });

  it("uses a keyboard-operable button without bubbling clicks to the parent card", () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <TagList items={["Action", "RPG", "Strategy"]} maxVisible={1} />
      </div>
    );
    const trigger = screen.getByRole("button", { name: "Show 2 more items" });

    expect(trigger.tagName).toBe("BUTTON");
    fireEvent.click(trigger);

    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("Strategy")).toBeInTheDocument();
  });
});
