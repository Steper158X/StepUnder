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
} from "solid-js";
import { X } from "lucide-solid";
import type { Lyrics, Song } from "~/lib/types";
import { usePlayer } from "~/player/store";
import { useServers } from "~/state/servers";
import { t } from "~/i18n";
import { Cover, Spinner } from "~/components/common";
import { cn } from "~/lib/utils";

/** Lyrics are immutable per song, so keep them around while the app runs. */
const lyricsCache = new Map<string, Lyrics | null>();

function trackMeta(track: Song) {
  return [track.artist, track.album].filter(Boolean).join(" · ");
}

/** Shared size so the artwork keeps its scale in the lyrics view. */
const coverClass =
  "aspect-square w-[clamp(10rem,46vh,26rem)] max-w-full rounded-2xl shadow-2xl ring-1 ring-foreground/10";

function LyricsPanel(props: { song: Song; active: boolean }) {
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

    const cached = lyricsCache.get(song.id);
    if (cached !== undefined) {
      setLyrics(cached);
      return;
    }

    setLyrics(undefined);
    void (async () => {
      const result =
        (await client.getLyricsBySongId(song.id)) ??
        (await client.getLyrics(song.artist ?? "", song.title));
      lyricsCache.set(song.id, result);
      if (cancelled) return;
      setLyrics(result);
    })();
  });

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
    lyrics();
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
        when={lyrics()}
        fallback={
          <div class="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t("player.lyricsEmpty")}
          </div>
        }
      >
        {(data: Accessor<Lyrics>) => (
          <div
            ref={observeScroller}
            class="relative min-h-0 flex-1 overflow-y-auto pr-2"
          >
            <div class="h-1/2" />
            <div class="flex flex-col gap-4">
              <For each={data().lines}>
                {(line, index) => {
                  const clickable = () =>
                    data().synced && line.start !== undefined;
                  return (
                    <button
                      type="button"
                      data-line={index()}
                      disabled={!clickable()}
                      onClick={() => {
                        if (line.start !== undefined) player.seek(line.start);
                      }}
                      class={cn(
                        "block w-full border-l-2 pl-4 text-left text-2xl leading-relaxed transition-[color,border-color,opacity,background-color] duration-300 md:text-3xl",
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
    <div class="flex min-h-0 flex-1 items-stretch overflow-hidden">
      {/* Artwork: full width when closed, slides to the left when lyrics open */}
      <div
        class={cn(
          "flex min-h-0 shrink-0 flex-col items-center justify-center gap-6 py-4 transition-[width] duration-500 ease-out",
          lyricsOpen() ? "w-1/2" : "w-full",
        )}
      >
        <Cover
          coverArtId={props.track.coverArt}
          size={1000}
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
          lyricsOpen() ? "w-1/2 opacity-100" : "w-0 opacity-0",
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
      <div class="absolute inset-0" aria-hidden="true">
        <Cover
          coverArtId={props.track.coverArt}
          size={1000}
          alt=""
          class="size-full scale-110 blur-[80px]"
          iconClass="size-32"
        />
        <div class="absolute inset-0 bg-background/40" />
        <div class="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/70" />
      </div>

      <div class="relative flex h-full animate-now-playing-in flex-col px-5 py-4">
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

export function NowPlaying() {
  const player = usePlayer();

  return (
    <Show when={player.nowPlayingOpen() && player.current()}>
      {(track) => <NowPlayingView track={track()} />}
    </Show>
  );
}
