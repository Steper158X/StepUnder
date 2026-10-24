import { Show, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import {
  Heart,
  Infinity as InfinityIcon,
  ListMusic,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-solid";
import { usePlayer } from "~/player/store";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { formatTime } from "~/lib/format";
import { subsonicErrorKey } from "~/lib/subsonic";
import { cn } from "~/lib/utils";
import { toast } from "~/components/toaster";
import { Cover } from "~/components/common";
import { Slider } from "~/components/ui/slider";

function ControlButton(props: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: import("solid-js").JSX.Element;
  class?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick?.()}
      disabled={props.disabled}
      title={props.label}
      aria-label={props.label}
      class={cn(
        "flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40 max-md:p-2",
        props.active && "text-primary hover:text-primary",
        props.class,
      )}
    >
      {props.children}
    </button>
  );
}

export function PlayerBar(props: {
  floating?: boolean;
  ref?: (element: HTMLDivElement) => void;
}) {
  const player = usePlayer();
  const servers = useServers();
  const [drag, setDrag] = createSignal<number | null>(null);
  const [starBusy, setStarBusy] = createSignal(false);

  const track = () => player.current();
  const duration = () => player.state.duration || track()?.duration || 0;
  const position = () => drag() ?? player.state.position;
  const starred = () => {
    const current = track();
    return current ? player.isStarred(current) : false;
  };

  async function toggleStar() {
    const current = track();
    const client = servers.client();
    if (!current || !client || starBusy()) return;
    setStarBusy(true);
    const next = !starred();
    try {
      if (next) await client.star(current.id);
      else await client.unstar(current.id);
      player.patchSongStar(current.id, next);
      toast(t(next ? "toast.starred" : "toast.unstarred"), undefined, "success");
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setStarBusy(false);
    }
  }

  /** Format, bit depth and sample rate of the playing track, e.g. "FLAC · 24-bit · 96 kHz". */
  const quality = () => {
    const current = track();
    if (!current) return "";
    const khz = current.samplingRate
      ? `${Number((current.samplingRate / 1000).toFixed(1))} kHz`
      : "";
    return [
      current.suffix?.toUpperCase(),
      current.bitDepth ? `${current.bitDepth}-bit` : "",
      khz,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  function toggleAutoMix() {
    const current = track();
    if (player.state.radio) player.stopRadio();
    else if (current) player.startRadio(current);
  }

  const volumeIcon = () => {
    if (player.state.muted || player.state.volume === 0) return VolumeX;
    if (player.state.volume < 0.5) return Volume1;
    return Volume2;
  };

  return (
    <div
      ref={props.ref}
      class={cn(
        "shrink-0",
        props.floating
          ? "glass-panel absolute inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-10 animate-fade-in rounded-2xl border border-border/50 bg-card/55 shadow-2xl shadow-black/30 backdrop-blur-2xl backdrop-saturate-150 transition-[background-color,border-color] duration-300 focus-within:border-border/80 focus-within:bg-card/85 hover:border-border/80 hover:bg-card/85 md:inset-x-3 md:bottom-3"
          : "glass-bar border-t border-border/60 bg-card/50 pb-[env(safe-area-inset-bottom)] backdrop-blur",
      )}
    >
      <div
        class={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(320px,1.5fr)_minmax(0,1fr)] md:gap-4 md:px-4 md:py-0",
          props.floating ? "md:h-[80px]" : "md:h-[92px]",
        )}
      >
        <div class="flex min-w-0 items-center gap-2.5 md:gap-3">
          <button
            type="button"
            onClick={() => player.setNowPlayingOpen(!player.nowPlayingOpen())}
            disabled={!track()}
            title={t(
              player.nowPlayingOpen()
                ? "action.close"
                : "player.openFullscreen",
            )}
            aria-label={t(
              player.nowPlayingOpen()
                ? "action.close"
                : "player.openFullscreen",
            )}
            class="group shrink-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          >
            <Cover
              coverArtId={track()?.coverArt}
              size={96}
              alt={track()?.album ?? track()?.title ?? ""}
              class="size-11 rounded-md shadow-sm transition-transform duration-200 group-enabled:group-hover:scale-105 md:size-12"
            />
          </button>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">
              <Show
                when={track()?.albumId}
                fallback={track()?.title ?? t("player.nothingPlaying")}
              >
                {(albumId) => (
                  <A
                    href={`/album/${albumId()}`}
                    title={track()?.album ?? track()?.title}
                    class="cursor-pointer rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {track()?.title}
                  </A>
                )}
              </Show>
            </p>
            <p
              class={cn(
                "truncate text-xs text-muted-foreground",
                player.state.error && "text-destructive",
              )}
            >
              <Show
                when={player.state.error}
                fallback={
                  <Show
                    when={track()?.artistId}
                    fallback={
                      track()?.artist ?? t("player.queueEmptyHint")
                    }
                  >
                    {(artistId) => (
                      <A
                        href={`/artist/${artistId()}`}
                        title={track()?.artist}
                        class="cursor-pointer rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {track()?.artist}
                      </A>
                    )}
                  </Show>
                }
              >
                {player.state.error}
              </Show>
            </p>
          </div>
          <Show when={track()}>
            <button
              type="button"
              onClick={() => void toggleStar()}
              class={cn(
                "ml-1 hidden cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default sm:block",
                starred() && "text-primary hover:text-primary",
              )}
              aria-label={t(starred() ? "action.unlike" : "action.like")}
            >
              <Heart class={cn("size-4", starred() && "fill-current")} />
            </button>
          </Show>
          <Show when={quality()}>
            <span
              title={quality()}
              class="hidden shrink-0 whitespace-nowrap rounded-md border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-yellow-600 dark:text-yellow-400 lg:inline-block"
            >
              {quality()}
            </span>
          </Show>
        </div>

        <div class="col-span-2 row-start-2 flex min-w-0 flex-col items-center gap-1 md:col-span-1 md:col-start-auto md:row-start-auto">
          <div class="flex items-center gap-0.5 md:gap-1">
            <ControlButton
              label={t("action.stop")}
              onClick={player.stop}
              disabled={!track()}
            >
              <Square class="size-3.5 fill-current" />
            </ControlButton>
            <ControlButton
              label={t("action.shuffle")}
              active={player.state.shuffle}
              onClick={player.toggleShuffle}
            >
              <Shuffle class="size-4" />
            </ControlButton>
            <ControlButton
              label={t("action.previous")}
              onClick={player.previous}
              disabled={!track()}
            >
              <SkipBack class="size-4 fill-current" />
            </ControlButton>
            <button
              type="button"
              onClick={player.toggle}
              disabled={!track()}
              class="mx-1 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105 disabled:cursor-default disabled:opacity-40 md:size-9"
              aria-label={t(player.state.playing ? "action.pause" : "action.play")}
            >
              <Show
                when={player.state.playing}
                fallback={<Play class="ml-0.5 size-4 fill-current" />}
              >
                <Pause class="size-4 fill-current" />
              </Show>
            </button>
            <ControlButton
              label={t("action.next")}
              onClick={player.next}
              disabled={!track()}
            >
              <SkipForward class="size-4 fill-current" />
            </ControlButton>
            <ControlButton
              label={t("action.repeat")}
              active={player.state.repeat !== "off"}
              onClick={player.cycleRepeat}
            >
              <Show
                when={player.state.repeat === "one"}
                fallback={<Repeat class="size-4" />}
              >
                <Repeat1 class="size-4" />
              </Show>
            </ControlButton>
            <ControlButton
              label={t("action.autoMix")}
              active={player.state.radio}
              disabled={!track()}
              onClick={toggleAutoMix}
            >
              <InfinityIcon
                class={cn("size-4", player.radioLoading() && "animate-pulse")}
              />
            </ControlButton>
          </div>

          <div class="flex w-full items-center gap-2">
            <span class="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground md:w-9 md:text-[11px]">
              {formatTime(position())}
            </span>
            <Slider
              value={position()}
              max={duration() || 1}
              step={1}
              disabled={!track() || duration() === 0}
              ariaLabel={t("player.nowPlaying")}
              class="flex-1"
              onValueChange={(value) => setDrag(value)}
              onValueCommit={(value) => {
                player.seek(value);
                setDrag(null);
              }}
            />
            <span class="w-8 shrink-0 text-[10px] tabular-nums text-muted-foreground md:w-9 md:text-[11px]">
              {formatTime(duration())}
            </span>
          </div>
        </div>

        <div class="col-start-2 row-start-1 flex items-center justify-end gap-0.5 md:col-start-auto md:row-start-auto md:gap-1.5">
          <div class="hidden items-center gap-1.5 md:flex">
            <ControlButton
              label={t(player.state.muted ? "action.unmute" : "action.mute")}
              onClick={player.toggleMute}
            >
              {(() => {
                const Icon = volumeIcon();
                return <Icon class="size-4" />;
              })()}
            </ControlButton>
            <Slider
              value={player.state.muted ? 0 : player.state.volume * 100}
              max={100}
              step={1}
              class="w-24"
              ariaLabel={t("action.volume")}
              onValueChange={(value) => player.setVolume(value / 100)}
            />
          </div>
          <ControlButton
            label={t("player.lyrics")}
            active={player.lyricsOpen()}
            disabled={!track()}
            onClick={player.toggleLyrics}
          >
            <MicVocal class="size-4" />
          </ControlButton>
          <ControlButton
            label={t("player.queue")}
            active={player.queueOpen()}
            onClick={() => player.setQueueOpen(!player.queueOpen())}
            class="relative"
          >
            <ListMusic class="size-4" />
            <Show when={player.state.queue.length > 0}>
              <span class="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {player.state.queue.length}
              </span>
            </Show>
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
