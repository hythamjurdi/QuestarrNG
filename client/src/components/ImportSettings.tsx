import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  FolderOpen,
  ArrowRight,
  Folder,
  Link,
  Copy,
  MoveRight,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ImportConfig, PlatformMapping, RomMConfig, UserSettings } from "@shared/schema";
import { selectedPlatformNames as resolveSelectedPlatformNames } from "@shared/platforms";
import type { IgdbPlatform } from "@shared/platforms";
import { PathMappingSettings } from "./PathMappingSettings";
import { FileBrowser } from "./FileBrowser";
import SecurityScanSettings from "./SecurityScanSettings";
import { InterfaceText } from "@/components/InterfaceText";
import { formatInterfaceMessage } from "@/lib/interface-locale";

const IMPORT_PIPELINE_STEP_TEXT = [
  [
    "Path translation",
    "The path reported by your download client (e.g. /downloads/Game.zip) is translated to the path that Questarr can actually read on its host. Configure this in Path Mappings if Questarr and your download client run in separate containers or machines.",
  ],
  [
    "Strategy selection",
    "Questarr inspects the game's platform and routes the file to the configured library root.",
  ],
  [
    "File transfer",
    "The file is hardlinked, copied, moved, or symlinked to its destination using the Transfer Mode you configured.",
  ],
  [
    "Game status update",
    'The download is marked "imported" and the game is marked "owned" in your library.',
  ],
  [
    "Manual review",
    'If Questarr cannot determine the correct destination — for example, because the platform slug is unknown — the download is flagged as "manual review required". You can resolve it from the Downloads page.',
  ],
] as const;

type HardlinkPairCheck = {
  sourcePath: string;
  targetPath: string;
  supported: boolean;
  sameDevice: boolean;
  reason?: string;
};

type HardlinkCapabilityResult = {
  targetRoot: string;
  supportedForAll: boolean | null;
  checkedSources: HardlinkPairCheck[];
  reason?: string;
};

type HardlinkCapabilityResponse = {
  generic: HardlinkCapabilityResult;
};

// ".nfo, sfv  .TXT" -> [".nfo", ".sfv", ".txt"]: normalizes case and the leading dot,
// drops blanks and duplicates.
export function parseExtensionList(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) continue;
    const ext = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
    if (/^\.[a-z0-9][a-z0-9._-]{0,15}$/.test(ext) && !out.includes(ext)) out.push(ext);
  }
  return out;
}

export default function ImportSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: config, isLoading: configLoading } = useQuery<ImportConfig>({
    queryKey: ["/api/imports/config"],
  });
  const { data: rommConfig } = useQuery<RomMConfig>({ queryKey: ["/api/imports/romm"] });
  const { data: platformMappings = [] } = useQuery<PlatformMapping[]>({
    queryKey: ["/api/imports/mappings/platforms"],
  });
  const { data: igdbPlatforms = [], isLoading: platformsLoading } = useQuery<IgdbPlatform[]>({
    queryKey: ["/api/igdb/platforms"],
  });
  const { data: hardlinkCapability } = useQuery<HardlinkCapabilityResponse>({
    queryKey: ["/api/imports/hardlink/check"],
  });
  const { data: extractionSettings } = useQuery<{ extractTempDir: string }>({
    queryKey: ["/api/imports/extraction"],
  });
  const { data: storageCheck } = useQuery<{
    inContainer: boolean;
    paths: Array<{ key: string; path: string; onContainerDisk: boolean }>;
  }>({ queryKey: ["/api/imports/storage-check"] });
  const onContainerDisk = (key: string): boolean =>
    !!(storageCheck?.paths ?? []).some((p) => p.key === key && p.onContainerDisk);
  // Read-only mirror of the Platforms card (Appearance tab), which owns this setting.
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    // SettingsPage owns the visible retry action after an initial failure.
    retryOnMount: false,
  });
  const selectedPlatformNames = resolveSelectedPlatformNames(
    igdbPlatforms,
    userSettings?.importPlatformIds
  );
  const selectedPlatformLabels = igdbPlatforms
    .filter((platform) => selectedPlatformNames.has(platform.name))
    .map((platform) => platform.name);
  // `selectedPlatformNames` returns every platform for an empty selection, so
  // its size cannot tell an unrestricted selection from a restricted one. Read
  // the restriction straight off the stored ids; otherwise the summary below
  // calls an active selection unrestricted, and an unrestricted one
  // "Eligible: <every platform>".
  const restrictedPlatformIds = Array.isArray(userSettings?.importPlatformIds)
    ? userSettings.importPlatformIds
    : [];
  // Platform ids can outlive an IGDB entry, and the list may still be loading,
  // so an active restriction does not always come with names to show.
  const platformEligibilitySummary = (() => {
    if (restrictedPlatformIds.length === 0) return "All platforms are currently eligible.";
    if (selectedPlatformLabels.length > 0) return `Eligible: ${selectedPlatformLabels.join(", ")}`;
    return platformsLoading
      ? "Loading eligible platforms..."
      : "Eligible platform names unavailable.";
  })();
  // Local State
  const [localConfig, setLocalConfig] = useState<ImportConfig | null>(null);
  const [localRommConfig, setLocalRommConfig] = useState<RomMConfig | null>(null);
  const [rommBindingsText, setRommBindingsText] = useState("{}");
  const [rommSkipText, setRommSkipText] = useState("");
  const [newMappingPlatformId, setNewMappingPlatformId] = useState("");
  const [newMappingSlug, setNewMappingSlug] = useState("");
  const [libraryBrowserOpen, setLibraryBrowserOpen] = useState(false);
  const [extractTempDir, setExtractTempDir] = useState("");
  const [rommTestResult, setRommTestResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);
  useEffect(() => {
    if (extractionSettings) setExtractTempDir(extractionSettings.extractTempDir);
  }, [extractionSettings]);
  useEffect(() => {
    if (rommConfig) {
      setLocalRommConfig(rommConfig);
      setRommBindingsText(JSON.stringify(rommConfig.platformBindings, null, 2));
      setRommSkipText((rommConfig.skipExtensions ?? []).join(", "));
    }
  }, [rommConfig]);

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: async (data: ImportConfig) => {
      // `importPlatformIds` is owned by the Platforms card. Sending it from here
      // would let a stale copy revert a change saved on that tab, so omit it and
      // let the route keep the stored value.
      const { importPlatformIds: _unused, ...rest } = data;
      await apiRequest("PATCH", "/api/imports/config", rest);
    },
    onSuccess: (_data, saved) => {
      // Switching post-processing on starts a scan of every enabled root folder.
      const scanStarted = saved.enablePostProcessing && !config?.enablePostProcessing;
      toast({
        title: "Settings Saved",
        description: scanStarted
          ? "Import configuration updated. Scanning your root folders for games now."
          : "Import configuration updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/storage-check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/hardlink/check"] });
      if (scanStarted) {
        queryClient.invalidateQueries({ queryKey: ["/api/library/scan/status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/library/scan/unmatched"] });
      }
    },
    onError: () => {
      if (config) setLocalConfig(config);
      toast({
        title: "Save Failed",
        description: "Could not update import settings.",
        variant: "destructive",
      });
    },
  });

  const updateRommConfigMutation = useMutation({
    mutationFn: async (data: RomMConfig) => {
      await apiRequest("PATCH", "/api/imports/romm", data);
    },
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "RomM import configuration updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/romm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/storage-check"] });
    },
    onError: () => {
      if (rommConfig) setLocalRommConfig(rommConfig);
      toast({
        title: "Save Failed",
        description: "Could not update RomM settings.",
        variant: "destructive",
      });
    },
  });

  const updateExtractionMutation = useMutation({
    mutationFn: async (value: string) => {
      await apiRequest("PUT", "/api/imports/extraction", { extractTempDir: value.trim() });
    },
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "Extraction temp directory updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/extraction"] });
      queryClient.invalidateQueries({ queryKey: ["/api/imports/storage-check"] });
    },
    onError: (error: Error) => {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    },
  });

  const testRommMutation = useMutation({
    mutationFn: async (data: { apiUrl: string; apiToken: string }) => {
      const res = await apiRequest("POST", "/api/imports/romm/test", data);
      return (await res.json()) as { ok: boolean; message: string };
    },
    onSuccess: (result) => setRommTestResult(result),
    onError: (error: Error) => setRommTestResult({ ok: false, message: error.message }),
  });

  const scanRommMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/imports/romm/scan", {});
      return (await res.json()) as { ok: boolean; message?: string };
    },
    onSuccess: () =>
      toast({ title: "RomM scan started", description: "RomM is scanning your ROM platforms." }),
    onError: (error: Error) =>
      toast({ title: "RomM scan failed", description: error.message, variant: "destructive" }),
  });

  const updatePlatformSlugMutation = useMutation({
    mutationFn: async ({
      id,
      rommPlatformSlug,
    }: {
      id: string;
      rommPlatformSlug: string | null;
    }) => {
      await apiRequest("PATCH", `/api/imports/mappings/platforms/${id}`, { rommPlatformSlug });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imports/mappings/platforms"] });
    },
  });

  const addPlatformMappingMutation = useMutation({
    mutationFn: async ({ platform, slug }: { platform: IgdbPlatform; slug: string }) => {
      await apiRequest("POST", "/api/imports/mappings/platforms", {
        igdbPlatformId: platform.id,
        sourcePlatformName: platform.name,
        rommPlatformSlug: slug.trim().toLowerCase() || null,
      });
    },
    onSuccess: () => {
      setNewMappingPlatformId("");
      setNewMappingSlug("");
      queryClient.invalidateQueries({ queryKey: ["/api/imports/mappings/platforms"] });
    },
    onError: (error: Error) =>
      toast({ title: "Save Failed", description: error.message, variant: "destructive" }),
  });

  const removePlatformMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/imports/mappings/platforms/${id}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/imports/mappings/platforms"] }),
  });

  const addMissingDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/imports/mappings/platforms/defaults", {});
      return (await res.json()) as { added: number };
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/imports/mappings/platforms"] }),
  });

  const initializePlatformMappingsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/imports/mappings/platforms/init", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imports/mappings/platforms"] });
    },
  });

  if (configLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="config" className="w-full">
        {/* Six tabs wrap into two columns on phones and sit in one row from sm up. */}
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-auto sm:gap-0">
          <TabsTrigger value="config">
            <InterfaceText source={"General Config"} />
          </TabsTrigger>
          <TabsTrigger value="romm">
            <InterfaceText source={"RomM"} />
          </TabsTrigger>
          <TabsTrigger value="paths">
            <InterfaceText source={"Path Mappings"} />
          </TabsTrigger>
          <TabsTrigger value="security">
            <InterfaceText source={"Security & Scanning"} />
          </TabsTrigger>
          <TabsTrigger value="discover">
            <InterfaceText source={"Discover"} />
          </TabsTrigger>
          <TabsTrigger value="help">
            <InterfaceText source={"Help"} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          {localConfig && (
            <>
              <Card>
                <CardContent className="pt-6 space-y-0">
                  {/* Master switch — always interactive */}
                  <div className="flex items-center justify-between pb-6">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        <InterfaceText source={"Enable Post-Processing"} />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText source={"Master switch for the import engine."} />
                      </p>
                      {localConfig.enablePostProcessing && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <InterfaceText
                            source={
                              "If your download client runs on a different machine or volume than Questarr, configure"
                            }
                          />{" "}
                          <span className="font-medium text-foreground">
                            <InterfaceText source={"Path Mappings"} />
                          </span>{" "}
                          <InterfaceText
                            source={"so Questarr can resolve the remote paths correctly."}
                          />
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={localConfig.enablePostProcessing}
                      onCheckedChange={(c) =>
                        setLocalConfig({ ...localConfig, enablePostProcessing: c })
                      }
                    />
                  </div>

                  <div
                    className={
                      localConfig.enablePostProcessing
                        ? undefined
                        : "opacity-50 pointer-events-none select-none"
                    }
                  >
                    <Separator className="mb-6" />

                    {/* ── Processing ── */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      <InterfaceText source={"Processing"} />
                    </p>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>
                            <InterfaceText source={"Auto-Unpack Archives"} />
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            <InterfaceText
                              source={
                                "Automatically extract zip, rar, and 7z archives before importing."
                              }
                            />
                          </p>
                        </div>
                        <Switch
                          checked={localConfig.autoUnpack}
                          onCheckedChange={(c) => setLocalConfig({ ...localConfig, autoUnpack: c })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>
                            <InterfaceText source={"Overwrite Existing Files"} />
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            <InterfaceText
                              source={"Replace files already present at the destination."}
                            />
                          </p>
                        </div>
                        <Switch
                          checked={localConfig.overwriteExisting}
                          onCheckedChange={(c) =>
                            setLocalConfig({ ...localConfig, overwriteExisting: c })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="extract-temp-dir">
                          <InterfaceText source={"Extraction temp directory"} />
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="extract-temp-dir"
                            placeholder="/downloads/.questarr-tmp"
                            data-i18n-placeholder={"/downloads/.questarr-tmp"}
                            value={extractTempDir}
                            onChange={(e) => setExtractTempDir(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={updateExtractionMutation.isPending}
                            onClick={() => updateExtractionMutation.mutate(extractTempDir)}
                          >
                            <InterfaceText source={"Save"} />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <InterfaceText
                            source={
                              "Optional scratch folder for unpacking archives. Leave empty to unpack beside the destination. Temporary files are always deleted afterwards."
                            }
                          />
                        </p>
                        {onContainerDisk("extractTempDir") && (
                          <p className="text-xs text-amber-500" role="alert">
                            <InterfaceText
                              source={
                                "This folder isn't a mounted volume, so it lives inside the container: files put here are lost when the container is updated (on Unraid they also fill docker.img). Map it to a share in the container settings, or pick a mounted path."
                              }
                            />
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator className="mb-6" />

                    {/* ── Library ── */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      <InterfaceText source={"Library"} />
                    </p>
                    <div className="space-y-4 mb-6">
                      <div className="space-y-1.5">
                        <Label>
                          <InterfaceText source={"Library Root"} />
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="/data/library"
                            value={localConfig.libraryRoot}
                            onChange={(e) =>
                              setLocalConfig({ ...localConfig, libraryRoot: e.target.value })
                            }
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setLibraryBrowserOpen(true)}
                            aria-label="Browse for library root folder"
                            data-i18n-aria-label={"Browse for library root folder"}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <InterfaceText source={"Where files are placed after import."} />
                        </p>
                        {onContainerDisk("libraryRoot") && (
                          <p className="text-xs text-amber-500" role="alert">
                            <InterfaceText
                              source={
                                "This folder isn't a mounted volume, so it lives inside the container: files put here are lost when the container is updated (on Unraid they also fill docker.img). Map it to a share in the container settings, or pick a mounted path."
                              }
                            />
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>
                          <InterfaceText source={"Transfer Mode"} />
                        </Label>
                        <Select
                          value={localConfig.transferMode}
                          onValueChange={(value) =>
                            setLocalConfig({
                              ...localConfig,
                              transferMode: value as "move" | "copy" | "hardlink",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hardlink">
                              <InterfaceText source={"Hardlink"} />
                            </SelectItem>
                            <SelectItem value="copy">
                              <InterfaceText source={"Copy"} />
                            </SelectItem>
                            <SelectItem value="move">
                              <InterfaceText source={"Move"} />
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          <InterfaceText
                            source={"Hardlink keeps torrents seeding while importing."}
                          />
                        </p>
                        {localConfig.transferMode === "move" &&
                          !localConfig.autoDeleteAfterImport && (
                            <p className="text-xs text-amber-500">
                              <InterfaceText
                                source={
                                  "Move deletes the original download. While auto-delete is off, Questarr copies instead so torrents keep seeding."
                                }
                              />
                            </p>
                          )}
                        {localConfig.transferMode === "hardlink" &&
                          hardlinkCapability?.generic.supportedForAll === true && (
                            <p className="text-xs text-emerald-500">
                              <InterfaceText source={"Hardlink supported."} />
                            </p>
                          )}
                        {localConfig.transferMode === "hardlink" &&
                          hardlinkCapability?.generic.supportedForAll === false && (
                            <p className="text-xs text-amber-500">
                              <InterfaceText
                                source={
                                  "Hardlink not available on this setup — will fall back to copy."
                                }
                              />
                            </p>
                          )}
                        {localConfig.transferMode === "hardlink" &&
                          hardlinkCapability?.generic.supportedForAll === null && (
                            <p className="text-xs text-muted-foreground">
                              <InterfaceText
                                source={
                                  "Hardlink check unavailable: configure at least one downloader path first."
                                }
                              />
                            </p>
                          )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>
                            <InterfaceText source={"Auto-delete source after import"} />
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            <InterfaceText
                              source={
                                "After a successful import (PC or RomM), remove the download from the client and delete its files. Leave off to keep seeding."
                              }
                            />
                          </p>
                        </div>
                        <Switch
                          checked={localConfig.autoDeleteAfterImport}
                          onCheckedChange={(c) =>
                            setLocalConfig({ ...localConfig, autoDeleteAfterImport: c })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="sort-extras">
                            <InterfaceText source={"Sort add-on files into subfolders"} />
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            <InterfaceText
                              source={
                                "For directory imports, place detected DLC, updates, and extras in"
                              }
                            />{" "}
                            <code>dlc/</code>, <code>update/</code>
                            <InterfaceText source={", and"} /> <code>extra/</code>{" "}
                            <InterfaceText
                              source={
                                "subfolders inside the game folder. Single-file imports keep their existing layout."
                              }
                            />
                          </p>
                        </div>
                        <Switch
                          id="sort-extras"
                          checked={localConfig.sortExtras}
                          onCheckedChange={(checked) =>
                            setLocalConfig({ ...localConfig, sortExtras: checked })
                          }
                        />
                      </div>
                    </div>

                    <Separator className="mb-6" />

                    {/* ── Platform Filter ── */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      <InterfaceText source={"Platform Filter"} />
                    </p>
                    <div className="mb-6">
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText
                          source={"Imports are restricted to the platforms chosen in the"}
                        />{" "}
                        <span className="font-medium text-foreground">
                          <InterfaceText source={"Platforms"} />
                        </span>{" "}
                        <InterfaceText
                          source={
                            "settings tab. Leave that list empty to make all platforms eligible."
                          }
                        />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {platformEligibilitySummary}
                      </p>
                    </div>

                    <Separator className="mb-6" />

                    {/* ── Naming ── */}
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      <InterfaceText source={"Naming"} />
                    </p>
                    <div className="space-y-1.5">
                      <Label>
                        <InterfaceText source={"Rename Pattern"} />
                      </Label>
                      <Input
                        value={localConfig.renamePattern}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, renamePattern: e.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText source={"Available tokens:"} /> {"{Title}"}, {"{Region}"},{" "}
                        {"{Platform}"}, {"{Year}"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => localConfig && updateConfigMutation.mutate(localConfig)}
                  disabled={updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <InterfaceText source={"Save Changes"} />
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="romm" className="space-y-4">
          {localRommConfig && (
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>
                      <InterfaceText source={"Route ROM imports to RomM"} />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      <InterfaceText
                        source={
                          "Games with a configured RomM platform slug are imported into this library."
                        }
                      />
                    </p>
                  </div>
                  <Switch
                    checked={localRommConfig.enabled}
                    onCheckedChange={(enabled) =>
                      setLocalRommConfig({ ...localRommConfig, enabled })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <InterfaceText source={"RomM ROM library root"} />
                  </Label>
                  <Input
                    value={localRommConfig.libraryRoot}
                    onChange={(event) =>
                      setLocalRommConfig({ ...localRommConfig, libraryRoot: event.target.value })
                    }
                    placeholder="/romm/library/roms"
                  />
                  <p className="text-xs text-muted-foreground">
                    <InterfaceText
                      source={
                        "The folder holding your platform folders, as mounted inside Questarr."
                      }
                    />
                  </p>
                  {onContainerDisk("rommLibraryRoot") && (
                    <p className="text-xs text-amber-500" role="alert">
                      <InterfaceText
                        source={
                          "This folder isn't a mounted volume, so it lives inside the container: files put here are lost when the container is updated (on Unraid they also fill docker.img). Map it to a share in the container settings, or pick a mounted path."
                        }
                      />
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <InterfaceText source={"Folder layout"} />
                  </Label>
                  <Select
                    value={localRommConfig.folderLayout}
                    onValueChange={(value) =>
                      setLocalRommConfig({
                        ...localRommConfig,
                        folderLayout: value as RomMConfig["folderLayout"],
                      })
                    }
                  >
                    <SelectTrigger
                      aria-label="Folder layout"
                      data-i18n-aria-label={"Folder layout"}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platform">
                        <InterfaceText source={"Library root → platform → game"} />
                      </SelectItem>
                      <SelectItem value="platform-roms">
                        <InterfaceText source={"Library root → platform → roms → game"} />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    <InterfaceText
                      source={"Match how your RomM library is organized. A PS2 game lands in:"}
                    />{" "}
                    <code className="break-all">
                      {`${(localRommConfig.libraryRoot || "").replace(/\/+$/, "")}/ps2${
                        localRommConfig.folderLayout === "platform-roms" ? "/roms" : ""
                      }/`}
                    </code>
                  </p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label>
                      <InterfaceText source={"Archives and extra files"} />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      <InterfaceText
                        source={
                          "Choose which archive types are extracted before files reach RomM. Unchecked types are copied as they are."
                        }
                      />
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="romm-unpack-rar">
                        <InterfaceText source={"Unpack RAR archives"} />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText
                          source={
                            "Includes multi-part sets (.part1.rar, or .rar with .r00, .r01…)."
                          }
                        />
                      </p>
                    </div>
                    <Switch
                      id="romm-unpack-rar"
                      checked={localRommConfig.unpackRar}
                      onCheckedChange={(unpackRar) =>
                        setLocalRommConfig({ ...localRommConfig, unpackRar })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="romm-unpack-7z">
                        <InterfaceText source={"Unpack 7z archives"} />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText
                          source={"Leave off if your RomM platforms store games as .7z files."}
                        />
                      </p>
                    </div>
                    <Switch
                      id="romm-unpack-7z"
                      checked={localRommConfig.unpack7z}
                      onCheckedChange={(unpack7z) =>
                        setLocalRommConfig({ ...localRommConfig, unpack7z })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="romm-unpack-zip">
                        <InterfaceText source={"Unpack zip archives"} />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText
                          source={
                            "Leave off for cartridge systems: RomM reads zipped ROMs directly."
                          }
                        />
                      </p>
                    </div>
                    <Switch
                      id="romm-unpack-zip"
                      checked={localRommConfig.unpackZip}
                      onCheckedChange={(unpackZip) =>
                        setLocalRommConfig({ ...localRommConfig, unpackZip })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="romm-skip-extensions">
                      <InterfaceText source={"Skip these file types"} />
                    </Label>
                    <Input
                      id="romm-skip-extensions"
                      value={rommSkipText}
                      placeholder=".nfo, .sfv, .txt"
                      data-i18n-placeholder={".nfo, .sfv, .txt"}
                      onChange={(event) => setRommSkipText(event.target.value)}
                      onBlur={() => {
                        const skipExtensions = parseExtensionList(rommSkipText);
                        setRommSkipText(skipExtensions.join(", "));
                        setLocalRommConfig({ ...localRommConfig, skipExtensions });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      <InterfaceText
                        source={
                          "Comma-separated. Release clutter with these extensions is never copied into RomM. Leave empty to copy everything."
                        }
                      />
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>
                      <InterfaceText source={"Platform folders"} />
                    </Label>
                    <Select
                      value={localRommConfig.platformRoutingMode}
                      onValueChange={(value) =>
                        setLocalRommConfig({
                          ...localRommConfig,
                          platformRoutingMode: value as RomMConfig["platformRoutingMode"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slug-subfolder">
                          <InterfaceText source={"RomM platform slug"} />
                        </SelectItem>
                        <SelectItem value="binding-map">
                          <InterfaceText source={"Custom folder bindings"} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      <InterfaceText source={"Transfer mode"} />
                    </Label>
                    <Select
                      value={localRommConfig.moveMode}
                      onValueChange={(value) =>
                        setLocalRommConfig({
                          ...localRommConfig,
                          moveMode: value as RomMConfig["moveMode"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="move">
                          <InterfaceText source={"Move"} />
                        </SelectItem>
                        <SelectItem value="copy">
                          <InterfaceText source={"Copy"} />
                        </SelectItem>
                        <SelectItem value="hardlink">
                          <InterfaceText source={"Hardlink"} />
                        </SelectItem>
                        <SelectItem value="symlink">
                          <InterfaceText source={"Symlink"} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {localRommConfig.moveMode === "move" && !config?.autoDeleteAfterImport && (
                      <p className="text-xs text-amber-500">
                        <InterfaceText
                          source={
                            "Move deletes the original download. While auto-delete is off, Questarr copies instead so torrents keep seeding."
                          }
                        />
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      <InterfaceText source={"Existing game policy"} />
                    </Label>
                    <Select
                      value={localRommConfig.conflictPolicy}
                      onValueChange={(value) =>
                        setLocalRommConfig({
                          ...localRommConfig,
                          conflictPolicy: value as RomMConfig["conflictPolicy"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rename">
                          <InterfaceText source={"Keep both with a new name"} />
                        </SelectItem>
                        <SelectItem value="skip">
                          <InterfaceText source={"Skip"} />
                        </SelectItem>
                        <SelectItem value="overwrite">
                          <InterfaceText source={"Replace existing"} />
                        </SelectItem>
                        <SelectItem value="fail">
                          <InterfaceText source={"Ask for review"} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      <InterfaceText source={"Single ROM placement"} />
                    </Label>
                    <Select
                      value={localRommConfig.singleFilePlacement}
                      onValueChange={(value) =>
                        setLocalRommConfig({
                          ...localRommConfig,
                          singleFilePlacement: value as RomMConfig["singleFilePlacement"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="root">
                          <InterfaceText source={"In the platform folder"} />
                        </SelectItem>
                        <SelectItem value="subfolder">
                          <InterfaceText source={"In a game folder"} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      <InterfaceText source={"Unmapped platform behavior"} />
                    </Label>
                    <Select
                      value={localRommConfig.bindingMissingBehavior}
                      onValueChange={(value) =>
                        setLocalRommConfig({
                          ...localRommConfig,
                          bindingMissingBehavior: value as RomMConfig["bindingMissingBehavior"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fallback">
                          <InterfaceText source={"Use the platform slug"} />
                        </SelectItem>
                        <SelectItem value="error">
                          <InterfaceText source={"Require a custom binding"} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {localRommConfig.platformRoutingMode === "binding-map" && (
                  <div className="space-y-1.5">
                    <Label>
                      <InterfaceText source={"Platform folder bindings (JSON)"} />
                    </Label>
                    <textarea
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                      value={rommBindingsText}
                      onChange={(event) => {
                        setRommBindingsText(event.target.value);
                        try {
                          const platformBindings = JSON.parse(event.target.value) as Record<
                            string,
                            string
                          >;
                          setLocalRommConfig({ ...localRommConfig, platformBindings });
                        } catch {
                          // Keep the last valid map until the JSON is corrected.
                        }
                      }}
                      onBlur={() => {
                        try {
                          const parsed = JSON.parse(rommBindingsText) as Record<string, string>;
                          setRommBindingsText(JSON.stringify(parsed, null, 2));
                        } catch {
                          setRommBindingsText(
                            JSON.stringify(localRommConfig.platformBindings, null, 2)
                          );
                        }
                      }}
                      aria-label="RomM platform folder bindings"
                      data-i18n-aria-label={"RomM platform folder bindings"}
                    />
                    <p className="text-xs text-muted-foreground">
                      <InterfaceText
                        source={
                          "Keys are RomM platform slugs; values are relative folders under the library root."
                        }
                      />
                    </p>
                  </div>
                )}
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label>
                      <InterfaceText source={"RomM scanning"} />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      <InterfaceText
                        source={
                          "After an import, ask RomM to scan the platforms that received new files."
                        }
                      />
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="romm-api-url">
                        <InterfaceText source={"RomM URL"} />
                      </Label>
                      <Input
                        id="romm-api-url"
                        value={localRommConfig.apiUrl}
                        placeholder="http://romm:8080"
                        data-i18n-placeholder={"http://romm:8080"}
                        onChange={(event) =>
                          setLocalRommConfig({ ...localRommConfig, apiUrl: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="romm-api-token">
                        <InterfaceText source={"API token"} />
                      </Label>
                      <Input
                        id="romm-api-token"
                        type="password"
                        autoComplete="off"
                        value={localRommConfig.apiToken}
                        placeholder="rmm_…"
                        data-i18n-placeholder={"rmm_…"}
                        onChange={(event) =>
                          setLocalRommConfig({ ...localRommConfig, apiToken: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <InterfaceText
                      source={
                        'Create a Client API Token in RomM with the "tasks.run" scope. Add "platforms.read" for RomM versions without the scan API.'
                      }
                    />
                  </p>
                  <div className="flex items-center justify-between">
                    <Label>
                      <InterfaceText source={"Scan RomM after import"} />
                    </Label>
                    <Switch
                      checked={localRommConfig.triggerScan}
                      onCheckedChange={(triggerScan) =>
                        setLocalRommConfig({ ...localRommConfig, triggerScan })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>
                        <InterfaceText source={"Scan type"} />
                      </Label>
                      <Select
                        value={localRommConfig.scanType}
                        onValueChange={(value) =>
                          setLocalRommConfig({
                            ...localRommConfig,
                            scanType: value as RomMConfig["scanType"],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick">
                            <InterfaceText source={"Quick (new files only)"} />
                          </SelectItem>
                          <SelectItem value="update">
                            <InterfaceText source={"Update metadata"} />
                          </SelectItem>
                          <SelectItem value="unmatched">
                            <InterfaceText source={"Unmatched games"} />
                          </SelectItem>
                          <SelectItem value="complete">
                            <InterfaceText source={"Complete rescan"} />
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        <InterfaceText source={"What to scan"} />
                      </Label>
                      <Select
                        value={localRommConfig.scanScope}
                        onValueChange={(value) =>
                          setLocalRommConfig({
                            ...localRommConfig,
                            scanScope: value as RomMConfig["scanScope"],
                          })
                        }
                      >
                        <SelectTrigger
                          aria-label="What to scan"
                          data-i18n-aria-label={"What to scan"}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="platforms">
                            <InterfaceText source={"Only platforms that got new games"} />
                          </SelectItem>
                          <SelectItem value="library">
                            <InterfaceText source={"The whole RomM library"} />
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="romm-scan-delay">
                        <InterfaceText source={"Scan delay (seconds)"} />
                      </Label>
                      <Input
                        id="romm-scan-delay"
                        type="number"
                        min={0}
                        max={3600}
                        value={localRommConfig.scanDebounceSeconds}
                        onChange={(event) =>
                          setLocalRommConfig({
                            ...localRommConfig,
                            scanDebounceSeconds: Math.max(
                              0,
                              Math.min(3600, Math.trunc(Number(event.target.value) || 0))
                            ),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        <InterfaceText
                          source={"Imports that finish within this window share one scan."}
                        />
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={testRommMutation.isPending}
                      onClick={() =>
                        testRommMutation.mutate({
                          apiUrl: localRommConfig.apiUrl,
                          apiToken: localRommConfig.apiToken,
                        })
                      }
                    >
                      {testRommMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <InterfaceText source={"Test connection"} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={scanRommMutation.isPending || !rommConfig?.apiToken}
                      onClick={() => scanRommMutation.mutate()}
                    >
                      <InterfaceText source={"Scan RomM now"} />
                    </Button>
                  </div>
                  {rommTestResult && (
                    <p
                      className={`text-xs ${rommTestResult.ok ? "text-emerald-500" : "text-amber-500"}`}
                      role="status"
                    >
                      {rommTestResult.message}
                    </p>
                  )}
                </div>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <Label>
                      <InterfaceText source={"Platform slug mappings"} />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      <InterfaceText
                        source={
                          "Set each platform's RomM folder name (e.g. ps5). It must match the platform folder in your RomM library exactly. Blank keeps that platform in the PC library."
                        }
                      />
                    </p>
                  </div>
                  {platformMappings.length === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={initializePlatformMappingsMutation.isPending}
                      onClick={() => initializePlatformMappingsMutation.mutate()}
                    >
                      <InterfaceText source={"Load default platform mappings"} />
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                        {platformMappings.map((mapping) => (
                          <div
                            key={mapping.id}
                            className="grid grid-cols-[1fr_1fr_auto] items-center gap-3"
                          >
                            <span className="truncate text-sm">
                              {igdbPlatforms.find(
                                (platform) => platform.id === mapping.igdbPlatformId
                              )?.name ?? (
                                <InterfaceText
                                  source={"IGDB platform {igdbPlatformId}"}
                                  values={{ igdbPlatformId: String(mapping.igdbPlatformId ?? "") }}
                                />
                              )}
                            </span>
                            <Input
                              aria-label={formatInterfaceMessage(
                                "RomM slug for platform {igdbPlatformId}",
                                { igdbPlatformId: String(mapping.igdbPlatformId ?? "") }
                              )}
                              defaultValue={mapping.rommPlatformSlug ?? ""}
                              placeholder="e.g. ps2"
                              onBlur={(event) => {
                                const value = event.target.value.trim();
                                const rommPlatformSlug = value || null;
                                if (rommPlatformSlug !== mapping.rommPlatformSlug) {
                                  updatePlatformSlugMutation.mutate({
                                    id: mapping.id,
                                    rommPlatformSlug,
                                  });
                                }
                              }}
                              data-i18n-placeholder={"e.g. ps2"}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={formatInterfaceMessage(
                                "Remove mapping for platform {igdbPlatformId}",
                                { igdbPlatformId: String(mapping.igdbPlatformId ?? "") }
                              )}
                              disabled={removePlatformMappingMutation.isPending}
                              onClick={() => removePlatformMappingMutation.mutate(mapping.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                        <Select
                          value={newMappingPlatformId}
                          onValueChange={setNewMappingPlatformId}
                        >
                          <SelectTrigger
                            aria-label="Platform to add"
                            data-i18n-aria-label={"Platform to add"}
                          >
                            <SelectValue
                              placeholder={formatInterfaceMessage("Choose a platform", {})}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {igdbPlatforms
                              .filter(
                                (platform) =>
                                  !platformMappings.some((m) => m.igdbPlatformId === platform.id)
                              )
                              .map((platform) => (
                                <SelectItem key={platform.id} value={String(platform.id)}>
                                  {platform.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          aria-label="RomM slug for the new platform"
                          data-i18n-aria-label={"RomM slug for the new platform"}
                          placeholder="e.g. ps2"
                          data-i18n-placeholder={"e.g. ps2"}
                          value={newMappingSlug}
                          onChange={(event) => setNewMappingSlug(event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!newMappingPlatformId || addPlatformMappingMutation.isPending}
                          onClick={() => {
                            const platform = igdbPlatforms.find(
                              (p) => String(p.id) === newMappingPlatformId
                            );
                            if (platform) {
                              addPlatformMappingMutation.mutate({ platform, slug: newMappingSlug });
                            }
                          }}
                        >
                          <InterfaceText source={"Add platform"} />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        disabled={addMissingDefaultsMutation.isPending}
                        onClick={() => addMissingDefaultsMutation.mutate()}
                      >
                        <InterfaceText source={"Add any missing default platforms"} />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={updateRommConfigMutation.isPending}
                    onClick={() => updateRommConfigMutation.mutate(localRommConfig)}
                  >
                    {updateRommConfigMutation.isPending ? (
                      <InterfaceText source={"Saving…"} />
                    ) : (
                      <InterfaceText source={"Save RomM settings"} />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paths" className="space-y-4">
          <PathMappingSettings />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityScanSettings />
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-6 text-sm">
              {/* ── How it works ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  <InterfaceText source={"How the import pipeline works"} />
                </p>
                <p className="text-muted-foreground mb-3">
                  <InterfaceText
                    source={
                      "When a download finishes, Questarr automatically runs through the following steps — no manual action needed unless a step requires your input."
                    }
                  />
                </p>
                <ol className="space-y-2 text-muted-foreground">
                  {IMPORT_PIPELINE_STEP_TEXT.map(([title, desc], i) => (
                    <li key={title} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          <InterfaceText source={title} /> —
                        </span>{" "}
                        <InterfaceText source={desc} />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <Separator />

              {/* ── Transfer modes ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  <InterfaceText source={"Transfer modes"} />
                </p>
                <div className="space-y-3">
                  {[
                    {
                      icon: <Link className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />,
                      label: "Hardlink",
                      desc: "Creates a second directory entry pointing to the same file on disk. Zero extra space used, and your torrent client continues seeding normally. Requires the source and destination to be on the same physical volume (same drive or mount point).",
                      when: "Best choice when your download folder and library are on the same disk. Preferred for seedbox-style setups.",
                    },
                    {
                      icon: <Copy className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
                      label: "Copy",
                      desc: "Duplicates the file to the destination. The original is kept intact so the torrent can continue seeding, but you use double the disk space.",
                      when: "Use when your library is on a different drive or network share than your download folder, and you still want to keep seeding.",
                    },
                    {
                      icon: <MoveRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
                      label: "Move",
                      desc: "Moves the file to the destination and removes it from the download folder. No extra space used, but the torrent will stop seeding.",
                      when: "Use when you do not care about seeding after import, or when disk space is tight.",
                    },
                    {
                      icon: <ArrowRight className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />,
                      label: "Symlink",
                      desc: "Creates a symbolic link at the destination pointing back to the original file in your download folder. The file is not duplicated or moved.",
                      when: "Use when you want your library to reflect downloads without copying files. The torrent keeps seeding.",
                    },
                  ].map(({ icon, label, desc, when }) => (
                    <div key={label} className="rounded-md border p-3 space-y-1">
                      <div className="flex items-start gap-2">
                        {icon}
                        <span className="font-medium text-foreground">
                          <InterfaceText source={label} />
                        </span>
                      </div>
                      <p className="text-muted-foreground pl-6">
                        <InterfaceText source={desc} />
                      </p>
                      <p className="text-xs text-muted-foreground pl-6">
                        <span className="font-medium text-foreground">
                          <InterfaceText source={"When to use:"} />{" "}
                        </span>
                        <InterfaceText source={when} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* ── General Config settings ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  <InterfaceText source={"General Config settings"} />
                </p>
                <div className="space-y-3">
                  {[
                    {
                      label: "Enable Post-Processing",
                      desc: "Master switch. When off, downloads are marked completed without any file being moved or organised. Turn this off if you manage your own file organisation externally.",
                    },
                    {
                      label: "Auto-Unpack Archives",
                      desc: "When enabled, zip, rar, and 7z archives are extracted before the files are transferred to the library. The extracted folder is what gets imported, not the archive itself.",
                    },
                    {
                      label: "Library Root",
                      desc: String.raw`Destination folder for imported games. Example: /data/library or D:\Games.`,
                    },
                    {
                      label: "Transfer Mode",
                      desc: "How files are transferred to the library root. See Transfer Modes above. Hardlink is recommended when possible.",
                    },
                    {
                      label: "Platform Filter",
                      desc: "Limits imports to the platforms chosen under Settings → Appearance → Platforms. If no platforms are checked, all platforms are eligible.",
                    },
                    {
                      label: "Rename Pattern",
                      desc: "Controls the file name after import. Tokens: {Title} = game title, {Region} = region tag from the release name, {Platform} = platform name, {Year} = release year. Example: {Title} ({Year}) ({Platform}).",
                    },
                  ].map(({ label, desc }) => (
                    <div key={label}>
                      <p className="font-medium text-foreground">
                        <InterfaceText source={label} />
                      </p>
                      <p className="text-muted-foreground">
                        <InterfaceText source={desc} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* ── Path Mappings ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  <InterfaceText source={"Path Mappings"} />
                </p>
                <p className="text-muted-foreground mb-2">
                  <InterfaceText
                    source={
                      "Path mappings translate paths between what your download client reports and what Questarr can access on its own filesystem."
                    }
                  />
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="font-medium text-foreground">
                      <InterfaceText source={"When you need this"} />
                    </p>
                    <p className="text-muted-foreground">
                      <InterfaceText
                        source={
                          "If Questarr and your download client are in different Docker containers (or on different machines), the same physical folder appears under different paths in each. For example, the download client might report"
                        }
                      />{" "}
                      <code className="text-xs bg-muted rounded px-1">/downloads/Game.iso</code>{" "}
                      <InterfaceText source={"while Questarr mounts that folder at"} />{" "}
                      <code className="text-xs bg-muted rounded px-1">/data/torrents/Game.iso</code>
                      <InterfaceText source={". Add a mapping with Remote path"} />{" "}
                      <code className="text-xs bg-muted rounded px-1">/downloads</code>{" "}
                      <InterfaceText source={"→ Local path"} />{" "}
                      <code className="text-xs bg-muted rounded px-1">/data/torrents</code>.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      <InterfaceText source={"When you do not need this"} />
                    </p>
                    <p className="text-muted-foreground">
                      <InterfaceText
                        source={
                          "If everything runs on the same host (or in a single container with shared mounts), paths are already consistent and no mapping is required."
                        }
                      />
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Common setups ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  <InterfaceText source={"Common setup examples"} />
                </p>
                <div className="space-y-4">
                  {[
                    {
                      title: "All-in-one (single host)",
                      steps: [
                        "Enable Post-Processing.",
                        "Set Library Root to where you want games stored (e.g. /data/library).",
                        "Set Transfer Mode to Hardlink if the download folder is on the same volume, otherwise Copy.",
                        "Leave Path Mappings empty.",
                      ],
                    },
                    {
                      title: "Separate containers (Questarr + download client)",
                      steps: [
                        "Enable Post-Processing.",
                        "Set Library Root to the path Questarr uses to reach the library folder.",
                        "Add a Path Mapping so the download client's reported path is translated to a path Questarr can read.",
                        "Set Transfer Mode to Hardlink (if all volumes are on the same device) or Copy.",
                      ],
                    },
                  ].map(({ title, steps }) => (
                    <div key={title} className="rounded-md border p-3 space-y-2">
                      <p className="font-medium text-foreground flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <InterfaceText source={title} />
                      </p>
                      <ol className="space-y-1 pl-1">
                        {steps.map((step, i) => (
                          <li key={step} className="flex gap-2 text-muted-foreground">
                            <span className="text-xs font-semibold text-primary mt-0.5 shrink-0">
                              {i + 1}.
                            </span>
                            <InterfaceText source={step} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {localConfig && (
        <FileBrowser
          open={libraryBrowserOpen}
          onOpenChange={setLibraryBrowserOpen}
          onSelect={(path) => {
            setLocalConfig({ ...localConfig, libraryRoot: path });
            setLibraryBrowserOpen(false);
          }}
          root="/"
          title="Select Library Root"
          initialPath="/"
          data-i18n-title={"Select Library Root"}
        />
      )}
    </div>
  );
}
