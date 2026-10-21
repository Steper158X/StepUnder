import { Show, createEffect, createSignal, on } from "solid-js";
import {
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
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
        "flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40",
        props.active && "text-primary hover:text-primary",
        props.class,
      )}
    >
      {props.children}
    </button>
  );
}

export function PlayerBar() {
  const player = usePlayer();
  const servers = useServers();
  const [drag, setDrag] = createSignal<number | null>(null);
  const [starred, setStarred] = createSignal(false);
  const [starBusy, setStarBusy] = createSignal(false);

  const track = () => player.current();
  const duration = () => player.state.duration || track()?.duration || 0;
  const position = () => drag() ?? player.state.position;

  createEffect(
    on(
      () => track()?.id,
      () => setStarred(Boolean(track()?.starred)),
    ),
  );

  async function toggleStar() {
    const current = track();
    const client = servers.client();
    if (!current || !client || starBusy()) return;
    setStarBusy(true);
    const next = !starred();
    try {
      if (next) await client.star(current.id);
      else await client.unstar(current.id);
      setStarred(next);
      player.patchSongStar(current.id, next);
      toast(t(next ? "toast.starred" : "toast.unstarred"), undefined, "success");
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setStarBusy(false);
    }
  }

  const volumeIcon = () => {
    if (player.state.muted || player.state.volume === 0) return VolumeX;
    if (player.state.volume < 0.5) return Volume1;
    return Volume2;
  };

  return (
    <div class="shrink-0 border-t border-border/60 bg-card/50 backdrop-blur">
      <div class="grid h-[92px] grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-4 px-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,1.5fr)_minmax(0,1fr)]">
        <div class="flex min-w-0 items-center gap-3">
          <Cover
            coverArtId={track()?.coverArt}
            size={96}
            alt={track()?.album ?? track()?.title ?? ""}
            class="size-12 rounded-md shadow-sm"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">
              {track()?.title ?? t("player.nothingPlaying")}
            </p>
            <p
              class={cn(
                "truncate text-xs text-muted-foreground",
                player.state.error && "text-destructive",
              )}
            >
              {player.state.error ??
                track()?.artist ??
                t("player.queueEmptyHint")}
            </p>
          </div>
          <Show when={track()}>
            <button
              type="button"
              onClick={() => void toggleStar()}
              class={cn(
                "ml-1 hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground sm:block",
                starred() && "text-primary hover:text-primary",
              )}
              aria-label={t(starred() ? "action.unlike" : "action.like")}
            >
              <Heart class={cn("size-4", starred() && "fill-current")} />
            </button>
          </Show>
        </div>

        <div class="flex min-w-0 flex-col items-center gap-1">
          <div class="flex items-center gap-1">
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
              class="mx-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105 disabled:opacity-40"
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
          </div>

          <div class="flex w-full items-center gap-2">
            <span class="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
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
            <span class="w-9 shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatTime(duration())}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-end gap-1.5">
          <ControlButton
            label={t(player.state.muted ? "action.unmute" : "action.mute")}
            onClick={player.toggleMute}
            class="hidden md:flex"
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
            class="hidden w-24 md:block"
            ariaLabel={t("action.volume")}
            onValueChange={(value) => player.setVolume(value / 100)}
          />
          <ControlButton
            label={t("player.queue")}
            onClick={() => player.setQueueOpen(true)}
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
