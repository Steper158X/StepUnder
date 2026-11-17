import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  type Accessor,
  type JSX,
} from "solid-js";
import {
  ChevronDown,
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
  X,
} from "lucide-solid";
import type { Lyrics, Song } from "~/lib/types";
import { usePlayer } from "~/player/store";
import { useServers } from "~/state/servers";
import { t } from "~/i18n";
import { BlurredArtwork, Cover, Spinner } from "~/components/common";
import { cn } from "~/lib/utils";
import { formatTime } from "~/lib/format";
import { isNarrow } from "~/lib/platform";
import { Slider } from "~/components/ui/slider";
import { toggleAutoMix, useCurrentStar } from "~/components/player-bar";
import { addPhonetics } from "~/lib/phonetic";
import { OutputButton } from "~/components/output-sheet";
import {
  LYRICS_BLUR_MAX,
  lyricsBlur,
  lyricsBlurSmooth,
  lyricsLineMarker,
  phoneticLyrics,
} from "~/state/settings";

const LYRICS_CACHE_LIMIT = 50;
const lyricsCache = new Map<string, Lyrics | null>();
/**
 * Same lyrics with generated reading lines filled in, keyed by the source
 * lyrics object (not the song id) so a result can never be attached to a
 * different song's lyrics when the song changes mid-conversion.
 */
const phoneticCache = new WeakMap<Lyrics, Lyrics>();

function trackMeta(track: Song) {
  return [track.artist, track.album].filter(Boolean).join(" · ");
}

/** Lines further than this from the sung line all get the same blur. */
const MAX_BLUR_LINES = 6;

/** Shared size so the artwork keeps its scale in the lyrics view. */
const coverClass =
  "aspect-square w-[clamp(10rem,46vh,26rem)] max-w-full rounded-2xl shadow-2xl ring-1 ring-foreground/10";

/** Lyrics of `song`, following playback; `compact` sizes it for the side column. */
export function LyricsPanel(props: {
  song: Song;
  active: boolean;
  compact?: boolean;
}) {
  const player = usePlayer();
  const servers = useServers();
  // undefined = loading, null = no lyrics available
  const [lyrics, setLyrics] = createSignal<Lyrics | null | undefined>(undefined);
  let scroller: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  createEffect(() => {
    const song = props.song;
    if (!props.active) return;
    const client = servers.client();
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });

    if (!client) {
      setLyrics(null);
      return;
    }

    const key = JSON.stringify([servers.activeId(), client.baseUrl, client.username, song.id]);
    const cached = lyricsCache.get(key);
    if (cached !== undefined) {
      lyricsCache.delete(key);
      lyricsCache.set(key, cached);
      setLyrics(cached);
      return;
    }

    setLyrics(undefined);
    void (async () => {
      const result =
        (await client.getLyricsBySongId(song.id)) ??
        (await client.getLyrics(song.artist ?? "", song.title));
      if (cancelled) return;
      lyricsCache.delete(key);
      lyricsCache.set(key, result);
      while (lyricsCache.size > LYRICS_CACHE_LIMIT) {
        lyricsCache.delete(lyricsCache.keys().next().value!);
      }
      setLyrics(result);
    })();
  });

  // Reading lines are built in the background; the plain lyrics show first.
  const [phonetic, setPhonetic] = createSignal<
    { source: Lyrics; result: Lyrics } | undefined
  >();
  createEffect(() => {
    const data = lyrics();
    setPhonetic(undefined);
    if (!data || !phoneticLyrics() || !props.active) return;
    const cached = phoneticCache.get(data);
    if (cached) {
      setPhonetic({ source: data, result: cached });
      return;
    }
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    void addPhonetics(data).then((result) => {
      phoneticCache.set(data, result);
      if (!cancelled) setPhonetic({ source: data, result });
    });
  });

  /** What the panel shows: lyrics with their reading lines when enabled. */
  const display = () => {
    const data = lyrics();
    if (!phoneticLyrics() || !data) return data;
    const built = phonetic();
    // Only use reading lines built from the lyrics currently shown.
    return built?.source === data ? built.result : data;
  };

  const activeIndex = createMemo(() => {
    const data = lyrics();
    if (!data?.synced) return -1;
    const position = player.state.position;
    let index = -1;
    for (let i = 0; i < data.lines.length; i += 1) {
      const start = data.lines[i].start;
      if (start === undefined) continue;
      if (start <= position + 0.2) index = i;
      else break;
    }
    return index;
  });

  function centerActiveLine(behavior: ScrollBehavior = "smooth") {
    const index = activeIndex();
    if (index < 0 || !scroller) return;
    const line = scroller.querySelector<HTMLElement>(`[data-line="${index}"]`);
    if (!line) return;
    scroller.scrollTo({
      top: Math.max(
        0,
        line.offsetTop - scroller.clientHeight / 2 + line.offsetHeight / 2,
      ),
      behavior,
    });
  }

  // Snap the current line to the center when the panel opens or lyrics load.
  createEffect(() => {
    if (!props.active) return;
    // Reading lines change line heights, so re-center when they appear.
    display();
    centerActiveLine("auto");
  });

  // Glide to the next line while playback moves on.
  createEffect(
    on(activeIndex, () => {
      if (props.active) centerActiveLine("smooth");
    }),
  );

  // The panel width animates, so re-center once the text has reflowed.
  function observeScroller(element: HTMLDivElement) {
    scroller = element;
    resizeObserver?.disconnect();
    if (typeof ResizeObserver === "undefined") return;
    resizeObserver = new ResizeObserver(() => {
      if (props.active) centerActiveLine("auto");
    });
    resizeObserver.observe(element);
  }

  onCleanup(() => resizeObserver?.disconnect());

  return (
    <Show
      when={lyrics() !== undefined}
      fallback={
        <div class="flex flex-1 items-center justify-center gap-3 text-xs text-muted-foreground">
          <Spinner class="size-4" />
          {t("player.lyricsLoading")}
        </div>
      }
    >
      <Show
        when={display()}
        fallback={
          <div class="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t("player.lyricsEmpty")}
          </div>
        }
      >
        {(data: Accessor<Lyrics>) => (
          <div
            ref={observeScroller}
            // The scroller clips the blur, so the gutter lives inside it to
            // leave the blurred glyphs room on both sides.
            class={cn(
              "lyrics-scroller relative min-h-0 flex-1 overflow-y-auto",
              props.compact ? "px-4" : "px-6",
            )}
          >
            <div class="h-1/2" />
            <div
              class={cn("flex flex-col", props.compact ? "gap-3" : "gap-4")}
            >
              <For each={data().lines}>
                {(line, index) => {
                  const clickable = () =>
                    data().synced && line.start !== undefined;
                  // Smooth blur grows with the distance from the sung line
                  // and tops out MAX_BLUR_LINES away; otherwise every other
                  // line gets the same half-strength blur.
                  const blur = () => {
                    const active = activeIndex();
                    if (!data().synced || active < 0) return 0;
                    const distance = Math.abs(index() - active);
                    if (distance === 0) return 0;
                    const max = LYRICS_BLUR_MAX[lyricsBlur()];
                    if (!lyricsBlurSmooth()) return max / 2;
                    return (max * Math.min(distance, MAX_BLUR_LINES)) /
                      MAX_BLUR_LINES;
                  };
                  return (
                    <button
                      type="button"
                      data-line={index()}
                      disabled={!clickable()}
                      onClick={() => {
                        if (line.start !== undefined) player.seek(line.start);
                      }}
                      style={{ "--lyric-blur": `${blur()}px` }}
                      class={cn(
                        "lyric-line block w-full text-left leading-relaxed transition-[color,border-color,opacity,background-color,filter] duration-300",
                        props.compact ? "text-xl" : "text-2xl md:text-3xl",
                        // Without the marker the text keeps the full width.
                        lyricsLineMarker() &&
                          (props.compact ? "border-l-2 pl-3" : "border-l-2 pl-4"),
                        !data().synced
                          ? "border-transparent text-foreground"
                          : index() === activeIndex()
                            ? "lyric-line-active border-primary font-semibold text-foreground"
                            : "border-transparent text-muted-foreground",
                        clickable() &&
                          "cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {line.value}
                      <Show when={phoneticLyrics() && line.phonetic}>
                        <span
                          class={cn(
                            "mt-1 block leading-snug font-normal opacity-70",
                            props.compact ? "text-sm" : "text-sm md:text-base",
                          )}
                        >
                          {line.phonetic}
                        </span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
            <div class="h-1/2" />
          </div>
        )}
      </Show>
    </Show>
  );
}

function NowPlayingBody(props: { track: Song }) {
  const player = usePlayer();
  const lyricsOpen = () => player.lyricsOpen();

  return (
    <div class="flex min-h-0 flex-1 flex-col items-stretch overflow-hidden md:flex-row">
      {/* Artwork: full width when closed, slides to the left when lyrics open */}
      <div
        class={cn(
          "flex min-h-0 shrink-0 flex-col items-center justify-center gap-6 py-4 transition-[width] duration-500 ease-out",
          lyricsOpen() ? "w-full max-md:hidden md:w-1/2" : "w-full",
        )}
      >
        <Cover
          coverArtId={props.track.coverArt}
          size={800}
          alt={props.track.album ?? props.track.title}
          class={coverClass}
          iconClass="size-16"
        />

        <div class="w-full max-w-xl px-2 text-center">
          <h2 class="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {props.track.title}
          </h2>
          <p class="mt-1.5 truncate text-sm text-muted-foreground">
            {trackMeta(props.track) || t("common.unknownArtist")}
          </p>
        </div>
      </div>

      {/* Lyrics: grows in from the right */}
      <div
        class={cn(
          "flex min-h-0 flex-col overflow-hidden transition-[width,opacity] duration-500 ease-out",
          lyricsOpen()
            ? "w-full flex-1 opacity-100 md:w-1/2 md:flex-none"
            : "w-0 flex-none opacity-0",
        )}
      >
        <LyricsPanel song={props.track} active={lyricsOpen()} />
      </div>
    </div>
  );
}

function NowPlayingView(props: { track: Song }) {
  const player = usePlayer();
  let panel: HTMLDivElement | undefined;

  onMount(() => {
    panel?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      player.setNowPlayingOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div
      ref={panel}
      tabindex="-1"
      role="dialog"
      aria-label={t("player.nowPlaying")}
      class="absolute inset-0 z-50 overflow-hidden bg-background outline-none"
    >
      {/* Large blurred album art backdrop */}
      <div class="now-playing-backdrop absolute inset-0" aria-hidden="true">
        {/* Blurred this heavily, a tiny thumbnail looks the same and decodes to a fraction of the memory. */}
        <BlurredArtwork
          coverArtId={props.track.coverArt}
          blurClass="blur-[80px]"
          class="size-full scale-110"
          iconClass="size-32"
        />
        <div class="absolute inset-0 bg-background/40" />
        <div class="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/70" />
      </div>

      <div class="relative flex h-full animate-now-playing-in flex-col px-3 py-3 pb-[var(--player-space,0.75rem)] md:px-5 md:py-4 md:pb-[var(--player-space,1rem)]">
        <div class="flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => player.setNowPlayingOpen(false)}
            title={t("action.close")}
            aria-label={t("action.close")}
            class="-mr-1.5 -mt-1 rounded-full p-2 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X class="size-5" />
          </button>
        </div>

        <NowPlayingBody track={props.track} />
      </div>
    </div>
  );
}

/** Round icon button used by the phone player. */
function SheetButton(props: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      disabled={props.disabled}
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      class={cn(
        "relative flex cursor-pointer items-center justify-center rounded-full p-2.5 text-foreground/75 transition-[color,transform] active:scale-90 disabled:cursor-default disabled:opacity-40",
        props.active && "text-primary",
        props.class,
      )}
    >
      {props.children}
    </button>
  );
}

/**
 * Phone full screen player: a sheet that slides up over the whole app with
 * its own controls, laid out like a phone music player.
 */
function PhoneNowPlaying(props: { track: Song; leaving: boolean }) {
  const player = usePlayer();
  const { starred, toggleStar } = useCurrentStar();
  const [drag, setDrag] = createSignal<number | null>(null);
  const duration = () => player.state.duration || props.track.duration || 0;
  const position = () => drag() ?? player.state.position;
  const close = () => player.setNowPlayingOpen(false);
  let panel: HTMLDivElement | undefined;

  onMount(() => {
    panel?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div
      ref={panel}
      tabindex="-1"
      role="dialog"
      aria-label={t("player.nowPlaying")}
      class={cn(
        "fixed inset-0 z-50 overflow-hidden bg-background outline-none",
        props.leaving
          ? "pointer-events-none animate-sheet-down"
          : "animate-sheet-up",
      )}
    >
      <div class="now-playing-backdrop absolute inset-0" aria-hidden="true">
        <BlurredArtwork
          coverArtId={props.track.coverArt}
          blurClass="blur-[80px]"
          class="size-full scale-110"
          iconClass="size-32"
        />
        <div class="absolute inset-0 bg-background/40" />
        <div class="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/70" />
      </div>

      <div class="relative flex h-full flex-col px-6 pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Header: only the chevron, which puts the player back down. */}
        <div class="-mx-2 flex h-14 shrink-0 items-center gap-2">
          <SheetButton label={t("action.close")} onClick={close}>
            <ChevronDown class="size-6" />
          </SheetButton>
        </div>

        {/* Artwork, or the lyrics in its place. */}
        <div class="flex min-h-0 flex-1 flex-col justify-center py-4">
          <Show
            when={player.lyricsOpen()}
            fallback={
              <Cover
                coverArtId={props.track.coverArt}
                size={800}
                alt={props.track.album ?? props.track.title}
                class="mx-auto aspect-square w-full max-w-[min(100%,46vh)] rounded-2xl shadow-2xl ring-1 ring-foreground/10"
                iconClass="size-16"
              />
            }
          >
            <div class="-mx-6 flex min-h-0 flex-1 flex-col">
              <LyricsPanel song={props.track} active compact />
            </div>
          </Show>
        </div>

        {/* Title, artist and favorite. */}
        <div class="flex shrink-0 items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-xl font-bold tracking-tight">
              {props.track.title}
            </h2>
            <p class="truncate text-sm text-muted-foreground">
              {props.track.artist || t("common.unknownArtist")}
            </p>
          </div>
          <SheetButton
            label={t(starred() ? "action.unlike" : "action.like")}
            active={starred()}
            onClick={() => void toggleStar()}
            class="-mr-2.5"
          >
            <Heart class={cn("size-6", starred() && "fill-current")} />
          </SheetButton>
        </div>

        {/* Seek bar. */}
        <div class="mt-4 shrink-0">
          <Slider
            value={position()}
            max={duration() || 1}
            step={1}
            disabled={duration() === 0}
            ariaLabel={t("player.nowPlaying")}
            onValueChange={(value) => setDrag(value)}
            onValueCommit={(value) => {
              player.seek(value);
              setDrag(null);
            }}
          />
          <div class="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{formatTime(position())}</span>
            <span>{formatTime(duration())}</span>
          </div>
        </div>

        {/* Transport. */}
        <div class="mt-3 flex shrink-0 items-center justify-between">
          <SheetButton
            label={t("action.shuffle")}
            active={player.state.shuffle}
            onClick={player.toggleShuffle}
            class="-ml-2.5"
          >
            <Shuffle class="size-5" />
          </SheetButton>
          <SheetButton label={t("action.previous")} onClick={player.previous}>
            <SkipBack class="size-8 fill-current" />
          </SheetButton>
          <button
            type="button"
            onClick={player.toggle}
            class="flex size-[4.5rem] cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
            aria-label={t(player.state.playing ? "action.pause" : "action.play")}
          >
            <Show
              when={player.state.playing}
              fallback={<Play class="ml-1 size-8 fill-current" />}
            >
              <Pause class="size-8 fill-current" />
            </Show>
          </button>
          <SheetButton label={t("action.next")} onClick={player.next}>
            <SkipForward class="size-8 fill-current" />
          </SheetButton>
          <SheetButton
            label={t("action.repeat")}
            active={player.state.repeat !== "off"}
            onClick={player.cycleRepeat}
            class="-mr-2.5"
          >
            <Show
              when={player.state.repeat === "one"}
              fallback={<Repeat class="size-5" />}
            >
              <Repeat1 class="size-5" />
            </Show>
          </SheetButton>
        </div>

        {/* Lyrics, auto mix, audio output (Android) and queue. */}
        <div class="mt-4 flex shrink-0 items-center justify-between">
          <SheetButton
            label={t("player.lyrics")}
            active={player.lyricsOpen()}
            onClick={player.toggleLyrics}
            class="-ml-2.5"
          >
            <MicVocal class="size-5" />
          </SheetButton>
          <SheetButton
            label={t("action.autoMix")}
            active={player.state.radio}
            onClick={() => toggleAutoMix(player)}
          >
            <InfinityIcon
              class={cn("size-5", player.radioLoading() && "animate-pulse")}
            />
          </SheetButton>
          <OutputButton />
          <SheetButton
            label={t("player.queue")}
            active={player.queueOpen()}
            onClick={() => player.setQueueOpen(!player.queueOpen())}
            class="-mr-2.5"
          >
            <ListMusic class="size-5" />
          </SheetButton>
        </div>
      </div>
    </div>
  );
}

export function NowPlaying() {
  const player = usePlayer();
  // On phones the sheet stays mounted for its slide-down after closing,
  // showing the track it had even if the queue was cleared meanwhile.
  const [leaving, setLeaving] = createSignal(false);
  const [lastTrack, setLastTrack] = createSignal<Song | null>(null);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(
    on(
      () => player.nowPlayingOpen(),
      (open, wasOpen) => {
        clearTimeout(leaveTimer);
        if (open) {
          setLeaving(false);
          return;
        }
        if (!wasOpen || !isNarrow()) return;
        setLeaving(true);
        leaveTimer = setTimeout(() => setLeaving(false), 280);
      },
    ),
  );
  onCleanup(() => clearTimeout(leaveTimer));

  createEffect(() => {
    const track = player.current();
    if (track) setLastTrack(track);
  });

  const track = () =>
    player.nowPlayingOpen()
      ? player.current()
      : leaving()
        ? lastTrack()
        : null;

  return (
    <Show when={track()}>
      {(current) => (
        <Show
          when={isNarrow()}
          fallback={<NowPlayingView track={current()} />}
        >
          <PhoneNowPlaying track={current()} leaving={leaving()} />
        </Show>
      )}
    </Show>
  );
}
