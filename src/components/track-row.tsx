import { A, useNavigate } from "@solidjs/router";
import { Show, createSignal, type JSX } from "solid-js";
import {
  Heart,
  Info,
  ListEnd,
  ListPlus,
  Play,
  Plus,
  Radio,
} from "lucide-solid";
import type { Song } from "~/lib/types";
import { usePlayer } from "~/player/store";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { formatTime } from "~/lib/format";
import { cn } from "~/lib/utils";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Cover, PlayingBars } from "~/components/common";
import { SongInfoDialog } from "~/components/song-info-dialog";
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
}) {
  const player = usePlayer();
  const navigate = useNavigate();
  const isCurrent = () => player.isCurrent(props.song.id);
  const isPlaying = () => isCurrent() && player.state.playing;
  const [infoOpen, setInfoOpen] = createSignal(false);

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
          class={cn(
            "group grid items-center gap-2 rounded-md px-1.5 py-2 transition-colors hover:bg-accent/60 sm:gap-3 sm:px-2 sm:py-1.5",
            props.showCover
              ? "grid-cols-[2rem_minmax(0,1fr)_auto]"
              : "grid-cols-[1.75rem_minmax(0,1fr)_auto]",
            isCurrent() && "bg-accent/40",
          )}
          onClick={() => {
            // Touch devices have no hover state, so play on a single tap while
            // keeping the familiar double-click behaviour on desktop.
            if (window.matchMedia("(hover: none)").matches) play();
          }}
          onDblClick={play}
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
                  player.toggle();
                }}
                class="relative size-8 overflow-hidden rounded"
                aria-label={t("action.play")}
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
            <TrackLikeButton song={props.song} revealOnHover />
            <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {formatTime(props.song.duration)}
            </span>
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
}) {
  return (
    <div class={cn("flex flex-col gap-0.5", props.class)}>
      {props.songs.map((song, index) => (
        <TrackRow
          song={song}
          index={index}
          context={props.songs}
          sourceName={props.sourceName}
          showCover={props.showCover}
          showAlbum={props.showAlbum}
          showArtist={props.showArtist}
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
