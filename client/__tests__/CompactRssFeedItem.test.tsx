/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import CompactRssFeedItem from "../src/components/CompactRssFeedItem";
import { type RssFeedItem } from "@shared/schema";

describe("CompactRssFeedItem accessibility", () => {
  it("gives the original-article link the feed item's title and hides its decorative icon", () => {
    const item = {
      id: "item-1",
      feedId: "feed-1",
      guid: "item-guid",
      title: "Example game release",
      link: "https://example.com/releases/example",
      pubDate: null,
      sourceName: "Example feed",
      igdbGameId: null,
      igdbGameName: null,
      coverUrl: null,
      createdAt: new Date(),
    } as unknown as RssFeedItem;

    render(<CompactRssFeedItem item={item} />);

    const link = screen.getByRole("link", {
      name: "View original article for Example game release",
    });
    expect(link).toHaveAttribute("href", "https://example.com/releases/example");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
