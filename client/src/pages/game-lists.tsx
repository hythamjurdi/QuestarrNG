import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, List, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { Game, GameList } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InterfaceText } from "@/components/InterfaceText";
import { formatInterfaceMessage, useInterfaceLanguage } from "@/lib/interface-locale";
import { formatRegionalNumber, useRegionalPreference } from "@/lib/regional-format";

type ListDialogMode = "create" | "rename" | null;

interface SaveListInput {
  mode: Exclude<ListDialogMode, null>;
  listId?: string;
  name: string;
}

interface MembershipInput {
  listId: string;
  gameId: string;
  add: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await apiRequest("GET", url);
  return response.json() as Promise<T>;
}

export default function GameListsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { language } = useInterfaceLanguage();
  const regionalPreference = useRegionalPreference();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listDialogMode, setListDialogMode] = useState<ListDialogMode>(null);
  const [editingListId, setEditingListId] = useState<string | undefined>();
  const [listName, setListName] = useState("");
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [addGamesOpen, setAddGamesOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState("");

  const { data: lists = [], isLoading: listsLoading } = useQuery<GameList[]>({
    queryKey: ["/api/game-lists"],
    queryFn: () => fetchJson<GameList[]>("/api/game-lists"),
  });

  const { data: libraryGames = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    queryFn: () => fetchJson<Game[]>("/api/games"),
  });

  const {
    data: listGames = [],
    isLoading: listGamesLoading,
    isError: listGamesError,
  } = useQuery<Game[]>({
    queryKey: ["/api/game-lists", selectedListId, "games"],
    queryFn: () => fetchJson<Game[]>(`/api/game-lists/${selectedListId}/games`),
    enabled: selectedListId !== null,
  });

  useEffect(() => {
    if (lists.length === 0) {
      if (selectedListId !== null) setSelectedListId(null);
      return;
    }
    if (!selectedListId || !lists.some((list) => list.id === selectedListId)) {
      setSelectedListId(lists[0]!.id);
    }
  }, [lists, selectedListId]);

  const selectedList = lists.find((list) => list.id === selectedListId);
  const memberIds = useMemo(() => new Set(listGames.map((game) => game.id)), [listGames]);
  const filteredLibraryGames = useMemo(() => {
    const query = gameSearch.trim().toLocaleLowerCase();
    return libraryGames.filter((game) => !query || game.title.toLocaleLowerCase().includes(query));
  }, [gameSearch, libraryGames]);

  const saveListMutation = useMutation<GameList, Error, SaveListInput>({
    mutationFn: async ({ mode, listId, name }) => {
      const response = await apiRequest(
        mode === "create" ? "POST" : "PATCH",
        mode === "create" ? "/api/game-lists" : `/api/game-lists/${listId}`,
        { name }
      );
      return response.json() as Promise<GameList>;
    },
    onSuccess: async (list) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/game-lists"] });
      setSelectedListId(list.id);
      setListDialogMode(null);
      setEditingListId(undefined);
      setListName("");
      toast({
        title: formatInterfaceMessage("List saved", {}, language),
        description: formatInterfaceMessage("“{name}” is ready.", { name: list.name }, language),
      });
    },
    onError: () => {
      toast({
        title: formatInterfaceMessage("Couldn't save list", {}, language),
        description: formatInterfaceMessage(
          "Check the name and try again. List names must be unique.",
          {},
          language
        ),
        variant: "destructive",
      });
    },
  });

  const deleteListMutation = useMutation<void, Error, string>({
    mutationFn: async (listId) => {
      await apiRequest("DELETE", `/api/game-lists/${listId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/game-lists"] });
      setDeleteListId(null);
    },
    onError: () => {
      toast({
        title: formatInterfaceMessage("Couldn't delete list", {}, language),
        variant: "destructive",
      });
    },
  });

  const membershipMutation = useMutation<void, Error, MembershipInput>({
    mutationFn: async ({ listId, gameId, add }) => {
      await apiRequest(
        add ? "POST" : "DELETE",
        add ? `/api/game-lists/${listId}/games` : `/api/game-lists/${listId}/games/${gameId}`,
        add ? { gameId } : undefined
      );
    },
    onSuccess: async (_result, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/game-lists", input.listId, "games"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/game-lists"] }),
      ]);
    },
    onError: () => {
      toast({
        title: formatInterfaceMessage("Couldn't update this list", {}, language),
        variant: "destructive",
      });
    },
  });

  const openRename = (list: GameList) => {
    setEditingListId(list.id);
    setListName(list.name);
    setListDialogMode("rename");
  };

  const saveList = () => {
    const name = listName.trim();
    if (!name) return;
    saveListMutation.mutate({
      mode: listDialogMode ?? "create",
      ...(editingListId ? { listId: editingListId } : {}),
      name,
    });
  };

  const toggleMembership = (gameId: string, checked: boolean) => {
    if (!selectedListId) return;
    membershipMutation.mutate({ listId: selectedListId, gameId, add: checked });
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <List className="h-6 w-6 text-primary" aria-hidden="true" />
            <InterfaceText source="Custom Lists" />
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            <InterfaceText source="Make your own collections for co-op nights, favorites, or whatever you want to play next." />
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingListId(undefined);
            setListName("");
            setListDialogMode("create");
          }}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          <InterfaceText source="Create list" />
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              <InterfaceText source="Your lists" />
            </CardTitle>
            <CardDescription>
              <InterfaceText source="Only you can see and edit these lists." />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {listsLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                <InterfaceText source="Loading lists…" />
              </div>
            ) : lists.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <InterfaceText source="Your lists will show up here. Start with one for a group, mood, or goal." />
              </p>
            ) : (
              lists.map((list) => (
                <div
                  key={list.id}
                  className={`flex items-center gap-1 rounded-md border p-1 ${
                    list.id === selectedListId
                      ? "border-primary/50 bg-primary/5"
                      : "border-transparent"
                  }`}
                >
                  <Button
                    variant="ghost"
                    className="min-w-0 flex-1 justify-start truncate text-left"
                    aria-pressed={list.id === selectedListId}
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <Archive className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{list.name}</span>
                    {list.id === selectedListId && !listGamesLoading && (
                      <span className="ml-auto pl-2 text-xs text-muted-foreground">
                        {listGames.length}
                      </span>
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    aria-label={formatInterfaceMessage(
                      "Rename {list}",
                      { list: list.name },
                      language
                    )}
                    data-i18n-aria-label="Rename {list}"
                    data-i18n-aria-label-values={JSON.stringify({ list: list.name })}
                    onClick={() => openRename(list)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={formatInterfaceMessage(
                      "Delete {list}",
                      { list: list.name },
                      language
                    )}
                    data-i18n-aria-label="Delete {list}"
                    data-i18n-aria-label-values={JSON.stringify({ list: list.name })}
                    onClick={() => setDeleteListId(list.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[360px]">
          {selectedList ? (
            <>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>{selectedList.name}</CardTitle>
                  <CardDescription className="mt-1">
                    <InterfaceText
                      source={listGames.length === 1 ? "{count} game" : "{count} games"}
                      values={{
                        count: formatRegionalNumber(
                          listGames.length,
                          undefined,
                          regionalPreference
                        ),
                      }}
                    />
                  </CardDescription>
                </div>
                <Button onClick={() => setAddGamesOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  <InterfaceText source="Add games" />
                </Button>
              </CardHeader>
              <CardContent>
                {listGamesLoading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <InterfaceText source="Loading games…" />
                  </div>
                ) : listGamesError ? (
                  <p role="alert" className="py-12 text-center text-sm text-destructive">
                    <InterfaceText source="Couldn't load games for this list. Try again in a moment." />
                  </p>
                ) : listGames.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center">
                    <Archive className="mb-3 h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
                    <h2 className="font-semibold">
                      <InterfaceText source="This list is ready for games" />
                    </h2>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      <InterfaceText source="Add games from your library. You can keep them in other lists too." />
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => setAddGamesOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      <InterfaceText source="Browse library" />
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y rounded-md border">
                    {listGames.map((game) => (
                      <div key={game.id} className="flex items-center gap-3 p-3">
                        {game.coverUrl ? (
                          <img
                            src={game.coverUrl}
                            alt=""
                            className="h-14 w-11 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-14 w-11 items-center justify-center rounded bg-muted">
                            <Archive className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{game.title}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            <InterfaceText source={game.status} />
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={formatInterfaceMessage(
                            "Remove {game} from {list}",
                            { game: game.title, list: selectedList.name },
                            language
                          )}
                          data-i18n-aria-label="Remove {game} from {list}"
                          data-i18n-aria-label-values={JSON.stringify({
                            game: game.title,
                            list: selectedList.name,
                          })}
                          disabled={membershipMutation.isPending}
                          onClick={() => toggleMembership(game.id, false)}
                        >
                          <X className="mr-1 h-4 w-4" aria-hidden="true" />
                          <InterfaceText source="Remove" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <List className="mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
              <h2 className="font-semibold">
                <InterfaceText source="Start a custom list" />
              </h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                <InterfaceText source="Collect games for a co-op night, a backlog goal, or any theme you like." />
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setListDialogMode("create")}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                <InterfaceText source="Create your first list" />
              </Button>
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog
        open={listDialogMode !== null}
        onOpenChange={(open) => !open && setListDialogMode(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <InterfaceText
                source={listDialogMode === "rename" ? "Rename list" : "Create a list"}
              />
            </DialogTitle>
            <DialogDescription>
              <InterfaceText source="Give it a short name so you can find the right games later." />
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label={formatInterfaceMessage("List name", {}, language)}
            data-i18n-aria-label="List name"
            maxLength={80}
            value={listName}
            onChange={(event) => setListName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && saveList()}
            placeholder={formatInterfaceMessage("e.g. Co-op with friends", {}, language)}
            data-i18n-placeholder="e.g. Co-op with friends"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialogMode(null)}>
              <InterfaceText source="Cancel" />
            </Button>
            <Button onClick={saveList} disabled={!listName.trim() || saveListMutation.isPending}>
              {saveListMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <InterfaceText source={listDialogMode === "rename" ? "Save name" : "Create list"} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addGamesOpen}
        onOpenChange={(open) => {
          setAddGamesOpen(open);
          if (!open) setGameSearch("");
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedList ? (
                <InterfaceText source="Add games to {list}" values={{ list: selectedList.name }} />
              ) : (
                <InterfaceText source="Add games to your list" />
              )}
            </DialogTitle>
            <DialogDescription>
              <InterfaceText source="Select games from your library. A game can be in more than one list." />
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={formatInterfaceMessage("Search library games", {}, language)}
              data-i18n-aria-label="Search library games"
              className="pl-9"
              placeholder={formatInterfaceMessage("Search your games…", {}, language)}
              data-i18n-placeholder="Search your games…"
              value={gameSearch}
              onChange={(event) => setGameSearch(event.target.value)}
            />
          </div>
          <ScrollArea className="h-[min(55vh,420px)] pr-3">
            {gamesLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <InterfaceText source="Loading library…" />
              </div>
            ) : filteredLibraryGames.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {libraryGames.length === 0 ? (
                  <InterfaceText source="Add games to your library before building a list." />
                ) : (
                  <InterfaceText source="No games match that search." />
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredLibraryGames.map((game) => {
                  const checked = memberIds.has(game.id);
                  const source = checked ? "Remove {game} from {list}" : "Add {game} to {list}";
                  const values = {
                    game: game.title,
                    list: selectedList?.name ?? formatInterfaceMessage("your list", {}, language),
                  };
                  return (
                    <label key={game.id} className="flex cursor-pointer items-center gap-3 py-2.5">
                      <Checkbox
                        checked={checked}
                        disabled={!selectedListId || membershipMutation.isPending}
                        onCheckedChange={(value) => toggleMembership(game.id, value === true)}
                        aria-label={formatInterfaceMessage(source, values, language)}
                        data-i18n-aria-label={source}
                        data-i18n-aria-label-values={JSON.stringify(values)}
                      />
                      {game.coverUrl ? (
                        <img src={game.coverUrl} alt="" className="h-12 w-9 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-9 items-center justify-center rounded bg-muted">
                          <Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {game.title}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        <InterfaceText source={game.status} />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGamesOpen(false)}>
              <InterfaceText source="Done" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteListId !== null}
        onOpenChange={(open) => !open && setDeleteListId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <InterfaceText source="Delete this list?" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <InterfaceText source="The games stay in your library. Only this list and its membership are removed." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <InterfaceText source="Cancel" />
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleteListId) deleteListMutation.mutate(deleteListId);
              }}
              disabled={deleteListMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteListMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <InterfaceText source="Delete list" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
