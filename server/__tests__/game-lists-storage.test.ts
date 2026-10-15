import { describe, expect, it } from "vitest";
import { MemStorage } from "../storage.js";
import type { InsertGame } from "../../shared/schema.js";

describe("custom game list storage", () => {
  it("keeps lists and memberships scoped to their owner and deletes memberships with a list", async () => {
    const storage = new MemStorage();
    const ownerGame = await storage.addGame({ title: "Portal 2", userId: "owner" } as InsertGame);
    const otherUserGame = await storage.addGame({ title: "Hades", userId: "other" } as InsertGame);
    const list = await storage.createGameList("owner", "Co-op with friends");
    const otherList = await storage.createGameList("other", "Private list");

    expect(await storage.getGameLists("owner")).toEqual([list]);
    expect(await storage.getGameList("other", list.id)).toBeUndefined();
    expect(await storage.addGameToList("owner", list.id, otherUserGame.id)).toBe(false);
    expect(await storage.addGameToList("owner", otherList.id, ownerGame.id)).toBe(false);

    expect(await storage.addGameToList("owner", list.id, ownerGame.id)).toBe(true);
    expect(await storage.addGameToList("owner", list.id, ownerGame.id)).toBe(true);
    expect(await storage.getGameListGames("owner", list.id)).toEqual([ownerGame]);

    const renamed = await storage.renameGameList("owner", list.id, "Weekend co-op");
    expect(renamed?.name).toBe("Weekend co-op");
    expect(await storage.deleteGameList("owner", list.id)).toBe(true);
    expect(await storage.getGameListGames("owner", list.id)).toBeUndefined();
  });
});
