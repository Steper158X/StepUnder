import { Show, onCleanup, onMount } from "solid-js";
import { X } from "lucide-solid";
import type { Song } from "~/lib/types";
import { usePlayer } from "~/player/store";
import { t } from "~/i18n";
import { Cover } from "~/components/common";

function NowPlayingView(props: { track: Song }) {
  const player = usePlayer();
  let panel: HTMLDivElement | undefined;

  const meta = () =>
    [props.track.artist, props.track.album].filter(Boolean).join(" · ");

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

        <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-4">
          <Cover
            coverArtId={props.track.coverArt}
            size={1000}
            alt={props.track.album ?? props.track.title}
            class="size-[clamp(10rem,46vh,26rem)] rounded-2xl shadow-2xl ring-1 ring-foreground/10"
            iconClass="size-16"
          />

          <div class="w-full max-w-xl text-center">
            <h2 class="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {props.track.title}
            </h2>
            <p class="mt-1.5 truncate text-sm text-muted-foreground">
              {meta() || t("common.unknownArtist")}
            </p>
          </div>
        </div>
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
