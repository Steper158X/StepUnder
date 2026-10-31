import { A, useNavigate } from "@solidjs/router";
import {
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import {
  Download,
  FolderOpen,
  GripVertical,
  Heart,
  Info,
  ListEnd,
  ListMusic,
  ListPlus,
  Play,
  Plus,
  Radio,
  Share2,
  Trash2,
  X,
} from "lucide-solid";
import type { Song } from "~/lib/types";
import { usePlayer } from "~/player/store";
import { useServers } from "~/state/servers";
import { usePlaylists } from "~/state/playlists";
import { revealDownload, useDownloads } from "~/state/downloads";
import { downloadOnStar } from "~/state/settings";
import { t, type MessageKey } from "~/i18n";
import { formatTime } from "~/lib/format";
import { cn } from "~/lib/utils";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Cover, PlayingBars } from "~/components/common";
import { SongInfoDialog } from "~/components/song-info-dialog";
import { ShareDialog } from "~/components/share-dialog";
import { DownloadIndicator } from "~/components/download-status";
import { Button } from "~/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";

function TrackLikeButton(props: {
  song: Song;
  class?: string;
  /** Show the heart permanently when the song is a favorite, otherwise only on row hover. */
  revealOnHover?: boolean;
}) {
  const servers = useServers();
  const player = usePlayer();
  const downloads = useDownloads();
  const [busy, setBusy] = createSignal(false);

  const starred = () => player.isStarred(props.song);

  async function toggleStar() {
    const client = servers.client();
    if (!client || busy()) return;
    setBusy(true);
    const next = !starred();
    try {
      if (next) await client.star(props.song.id);
      else await client.unstar(props.song.id);
      player.patchSongStar(props.song.id, next);
      toast(t(next ? "toast.starred" : "toast.unstarred"), undefined, "success");
      if (next && downloadOnStar()) downloads.download([props.song]);
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void toggleStar();
      }}
      class={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:p-2",
        starred() && "text-primary",
        props.revealOnHover &&
          !starred() &&
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100",
        props.class,
      )}
      title={t(starred() ? "action.unlike" : "action.like")}
      aria-label={t(starred() ? "action.unlike" : "action.like")}
    >
      <Heart
        class={cn("size-3.5 max-md:size-4", starred() && "fill-current")}
      />
    </button>
  );
}

export function TrackRow(props: {
  song: Song;
  index: number;
  context: Song[];
  sourceName?: string;
  showCover?: boolean;
  showAlbum?: boolean;
  showArtist?: boolean;
  showAlbumArt?: boolean;
  /** Shows "remove from playlist" actions. */
  onRemove?: () => void;
  /** Pointer-down on the drag handle; the handle only renders when set. */
  onDragStart?: (event: PointerEvent) => void;
  dropIndicator?: "before" | "after" | null;
  dragging?: boolean;
}) {
  const player = usePlayer();
  const playlists = usePlaylists();
  const downloads = useDownloads();
  const navigate = useNavigate();
  const downloadState = () => downloads.status(props.song)?.state ?? null;
  const isCurrent = () => player.isCurrent(props.song.id);
  const isPlaying = () => isCurrent() && player.state.playing;
  const [infoOpen, setInfoOpen] = createSignal(false);
  const [shareOpen, setShareOpen] = createSignal(false);

  function play() {
    player.playSong(props.song, props.context, props.sourceName);
  }

  const subtitle = () => {
    const parts: JSX.Element[] = [];
    if (props.showArtist !== false) {
      parts.push(
        <Show
          when={props.song.artistId}
          fallback={<span>{props.song.artist ?? t("common.unknownArtist")}</span>}
        >
          <A
            href={`/artist/${props.song.artistId}`}
            class="hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {props.song.artist ?? t("common.unknownArtist")}
          </A>
        </Show>,
      );
    }
    if (props.showAlbum) {
      if (parts.length) parts.push(<span class="px-1">•</span>);
      parts.push(
        <Show
          when={props.song.albumId}
          fallback={<span>{props.song.album ?? ""}</span>}
        >
          <A
            href={`/album/${props.song.albumId}`}
            class="hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {props.song.album ?? ""}
          </A>
        </Show>,
      );
    }
    return parts;
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          data-allow-context-menu
          data-track-index={props.index}
          class={cn(
            "group relative grid cursor-pointer items-center gap-2 rounded-md px-1.5 py-2 transition-colors hover:bg-accent/60 sm:gap-3 sm:px-2 sm:py-1.5",
            props.showCover
              ? "grid-cols-[2rem_minmax(0,1fr)_auto]"
              : "grid-cols-[1.75rem_minmax(0,1fr)_auto]",
            isCurrent() && "bg-accent/40",
            props.dragging && "bg-accent/70 opacity-60",
            props.dropIndicator === "before" &&
              "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-primary",
            props.dropIndicator === "after" &&
              "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
          )}
          onClick={() => {
            // A click on the track already playing must not restart it.
            if (!isCurrent()) play();
            else if (!player.state.playing) player.play();
          }}
        >
          <div class="flex items-center justify-center">
            <Show
              when={props.showCover && props.song.coverArt}
              fallback={
                <Show
                  when={isCurrent()}
                  fallback={
                    <>
                      <span class="text-xs tabular-nums text-muted-foreground group-hover:hidden">
                        {props.index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          play();
                        }}
                        class="hidden text-foreground group-hover:block"
                        aria-label={t("action.play")}
                      >
                        <Play class="size-3.5 fill-current" />
                      </button>
                    </>
                  }
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      player.toggle();
                    }}
                    aria-label={t(isPlaying() ? "action.pause" : "action.play")}
                  >
                    <PlayingBars paused={!isPlaying()} />
                  </button>
                </Show>
              }
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  // Only the playing track's cover pauses; others start playing.
                  if (isCurrent()) player.toggle();
                  else play();
                }}
                class="relative size-8 overflow-hidden rounded"
                aria-label={t(isPlaying() ? "action.pause" : "action.play")}
              >
                <Cover
                  coverArtId={props.song.coverArt}
                  size={64}
                  alt={props.song.album ?? props.song.title}
                  class="size-8 rounded"
                />
                <Show when={isCurrent()}>
                  <span class="absolute inset-0 flex items-center justify-center bg-black/50">
                    <PlayingBars paused={!isPlaying()} />
                  </span>
                </Show>
              </button>
            </Show>
          </div>

          <div class="min-w-0">
            <p
              class={cn(
                "truncate text-sm font-medium",
                isCurrent() && "text-primary",
              )}
              title={props.song.title}
            >
              {props.song.title}
            </p>
            <p class="flex min-w-0 items-center truncate text-xs text-muted-foreground">
              {subtitle()}
            </p>
          </div>

          <div class="flex items-center gap-1">
            <DownloadIndicator song={props.song} />
            <TrackLikeButton song={props.song} revealOnHover />
            <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {formatTime(props.song.duration)}
            </span>
            <Show when={props.onRemove}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onRemove?.();
                }}
                class="rounded-md p-1.5 text-muted-foreground opacity-0 transition-colors hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 max-md:p-2 max-md:opacity-100"
                title={t("playlist.removeSong")}
                aria-label={t("playlist.removeSong")}
              >
                <X class="size-3.5 max-md:size-4" />
              </button>
            </Show>
            <Show when={props.onDragStart}>
              <span
                role="button"
                tabIndex={-1}
                class="cursor-grab touch-none rounded-md p-1.5 text-muted-foreground opacity-40 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 active:cursor-grabbing max-md:p-2 max-md:opacity-100"
                title={t("playlist.dragToReorder")}
                aria-label={t("playlist.dragToReorder")}
                onPointerDown={(event) => props.onDragStart?.(event)}
                onClick={(event) => event.stopPropagation()}
              >
                <GripVertical class="size-3.5 max-md:size-4" />
              </span>
            </Show>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onSelect={play}>
            <Play class="size-4" />
            {t("action.play")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => player.playNext([props.song])}>
            <ListEnd class="size-4" />
            {t("action.playNext")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => player.addToQueue([props.song])}>
            <ListPlus class="size-4" />
            {t("action.addToQueue")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => player.startRadio(props.song)}>
            <Radio class="size-4" />
            {t("action.startRadio")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => playlists.openAddTo([props.song])}>
            <ListMusic class="size-4" />
            {t("playlist.addTo.action")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setShareOpen(true)}>
            <Share2 class="size-4" />
            {t("action.share")}
          </ContextMenuItem>
          <Show when={downloads.available}>
            <Switch>
              <Match when={downloadState() === "done"}>
                <ContextMenuItem
                  onSelect={() => {
                    const status = downloads.status(props.song);
                    if (status?.state === "done") {
                      void revealDownload(status.entry.path);
                    }
                  }}
                >
                  <FolderOpen class="size-4" />
                  {t("download.showInFolder")}
                </ContextMenuItem>
                <ContextMenuItem
                  class="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                  onSelect={() => downloads.remove([props.song])}
                >
                  <Trash2 class="size-4" />
                  {t("download.remove")}
                </ContextMenuItem>
              </Match>
              <Match
                when={
                  downloadState() === "queued" ||
                  downloadState() === "downloading"
                }
              >
                <ContextMenuItem onSelect={() => downloads.cancel([props.song])}>
                  <X class="size-4" />
                  {t("download.cancel")}
                </ContextMenuItem>
              </Match>
              <Match when={true}>
                <ContextMenuItem
                  onSelect={() => downloads.download([props.song])}
                >
                  <Download class="size-4" />
                  {t("download.download")}
                </ContextMenuItem>
              </Match>
            </Switch>
          </Show>
          <Show when={props.onRemove}>
            <ContextMenuItem
              class="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
              onSelect={() => props.onRemove?.()}
            >
              <X class="size-4" />
              {t("playlist.removeSong")}
            </ContextMenuItem>
          </Show>
          <ContextMenuSeparator />
          <Show when={props.song.albumId}>
            <ContextMenuItem
              onSelect={() => navigate(`/album/${props.song.albumId}`)}
            >
              <Plus class="size-4" />
              {t("action.goToAlbum")}
            </ContextMenuItem>
          </Show>
          <ContextMenuItem onSelect={() => setInfoOpen(true)}>
            <Info class="size-4" />
            {t("action.songInfo")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <SongInfoDialog
        song={props.song}
        open={infoOpen()}
        onOpenChange={setInfoOpen}
      />
      <ShareDialog
        song={props.song}
        open={shareOpen()}
        onOpenChange={setShareOpen}
      />
    </>
  );
}

export function TrackList(props: {
  songs: Song[];
  sourceName?: string;
  showCover?: boolean;
  showAlbum?: boolean;
  showArtist?: boolean;
  class?: string;
  /** Enables the drag handle; called with the old and new index. */
  onMove?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
}) {
  let container: HTMLDivElement | undefined;
  // `over` is the insertion slot, 0..songs.length.
  const [drag, setDrag] = createSignal<{ from: number; over: number } | null>(
    null,
  );
  let stopDrag: (() => void) | undefined;
  onCleanup(() => stopDrag?.());

  function scrollParent(element: HTMLElement | null): HTMLElement | null {
    for (let node = element?.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === "auto" || overflow === "scroll") return node;
    }
    return null;
  }

  function startDrag(index: number, event: PointerEvent) {
    if (event.button !== 0 || !container) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const scroller = scrollParent(container);
    setDrag({ from: index, over: index });

    const move = (moveEvent: PointerEvent) => {
      const rows = Array.from(
        container!.querySelectorAll<HTMLElement>("[data-track-index]"),
      );
      let over = rows.length;
      for (let i = 0; i < rows.length; i += 1) {
        const rect = rows[i].getBoundingClientRect();
        if (moveEvent.clientY < rect.top + rect.height / 2) {
          over = i;
          break;
        }
      }
      setDrag((current) => (current ? { ...current, over } : current));

      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        const edge = 56;
        if (moveEvent.clientY < bounds.top + edge) scroller.scrollBy(0, -12);
        else if (moveEvent.clientY > bounds.bottom - edge) scroller.scrollBy(0, 12);
      }
    };

    const finish = (commit: boolean) => {
      const state = drag();
      stopDrag?.();
      if (!commit || !state) return;
      const to = state.over > state.from ? state.over - 1 : state.over;
      if (to !== state.from) props.onMove?.(state.from, to);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") cancel();
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    document.body.classList.add("select-none");
    stopDrag = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      document.body.classList.remove("select-none");
      setDrag(null);
      stopDrag = undefined;
    };
  }

  function indicator(index: number): "before" | "after" | null {
    const state = drag();
    // Dropping right above or below the dragged row changes nothing.
    if (!state || state.over === state.from || state.over === state.from + 1) {
      return null;
    }
    if (state.over === index) return "before";
    if (state.over === props.songs.length && index === props.songs.length - 1) {
      return "after";
    }
    return null;
  }

  return (
    <div ref={container} class={cn("flex flex-col gap-0.5", props.class)}>
      {props.songs.map((song, index) => (
        <TrackRow
          song={song}
          index={index}
          context={props.songs}
          sourceName={props.sourceName}
          showCover={props.showCover}
          showAlbum={props.showAlbum}
          showArtist={props.showArtist}
          onRemove={props.onRemove ? () => props.onRemove!(index) : undefined}
          onDragStart={
            props.onMove ? (event) => startDrag(index, event) : undefined
          }
          dropIndicator={indicator(index)}
          dragging={drag()?.from === index}
        />
      ))}
    </div>
  );
}

export function PlayAllButton(props: {
  songs: Song[];
  sourceName?: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const player = usePlayer();
  return (
    <Button
      variant={props.variant ?? "default"}
      disabled={!props.songs.length}
      onClick={() => {
        if (!props.songs.length) return;
        player.playNow(props.songs, 0, props.sourceName);
      }}
    >
      <Play class="size-4 fill-current" />
      {props.label ?? t("action.play")}
    </Button>
  );
}
