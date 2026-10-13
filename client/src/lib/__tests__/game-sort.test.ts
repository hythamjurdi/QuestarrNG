import { describe, expect, it } from "vitest";
import { type Game } from "@shared/schema";
import { sortLibraryGames } from "../game-sort";

describe("sortLibraryGames", () => {
  it("uses the selected interface language for title collation", () => {
    const games = [{ title: "ñandú" }, { title: "nube" }] as Game[];

    expect(sortLibraryGames(games, "title-asc", "es").map((game) => game.title)).toEqual([
      "nube",
      "ñandú",
    ]);
  });
});
