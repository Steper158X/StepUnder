import { A, useNavigate, useParams } from "@solidjs/router";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import {
  Disc3,
  Ellipsis,
  Heart,
  ListEnd,
  ListMusic,
  ListPlus,
  Mic2,
  Play,
  Shuffle,
} from "lucide-solid";
import type { Album, Song } from "~/lib/types";
import { coverColor, glowHsl } from "~/lib/cover-color";
import { useDownloads } from "~/state/downloads";
import { downloadOnStar } from "~/state/settings";
import { cn } from "~/lib/utils";
import { RatingStars, useStar } from "~/components/annotations";
import { useServers } from "~/state/servers";
import { usePlaylists } from "~/state/playlists";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { formatTime, formatYear } from "~/lib/format";
import { Cover, ErrorState } from "~/components/common";
import { Page } from "~/components/layout-bits";
import { TrackList } from "~/components/track-row";
import { Button } from "~/components/ui/button";
import { DownloadAllButton } from "~/components/download-status";
import { Skeleton } from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { genreHref } from "~/routes/genres";

function AlbumLikeButton(props: { album: Album; songs: Song[] }) {
  const downloads = useDownloads();
  const { starred, toggle, busy } = useStar(() => props.album, {
    onStarred: () => {
      if (downloadOnStar() && props.songs.length) {
        downloads.download(props.songs);
      }
    },
  });
  const label = () => t(starred() ? "action.unlike" : "action.like");
  return (
    <Button
      variant="ghost"
      size="icon"
      class={cn("shrink-0", starred() && "text-primary")}
      onClick={() => void toggle()}
      disabled={busy()}
      title={label()}
      aria-label={label()}
      aria-pressed={starred()}
    >
      <Heart class={cn("size-4", starred() && "fill-current")} />
    </Button>
  );
}

/** "a • b • c" from whichever parts are present. */
function MetaLine(props: { parts: (string | false | null | undefined)[]; class?: string }) {
  const parts = () => props.parts.filter(Boolean) as string[];
  return (
    <p class={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5", props.class)}>
      <For each={parts()}>
        {(part, index) => (
          <>
            <Show when={index() > 0}>
              <span aria-hidden="true" class="opacity-50">
                •
              </span>
            </Show>
            <span class="whitespace-nowrap">{part}</span>
          </>
        )}
      </For>
    </p>
  );
}

export default function AlbumPage() {
  const params = useParams();
  const servers = useServers();
  const player = usePlayer();
  const playlists = usePlaylists();
  const navigate = useNavigate();

  const [data, { refetch: reloadAlbum }] = createResource(
    () => (servers.client() && params.id ? params.id : undefined),
    (id) => servers.client()!.getAlbum(id),
  );

  const album = () => data()?.album;
  const songs = () => data()?.songs ?? [];
  const totalDuration = createMemo(() =>
    songs().reduce((total, song) => total + (song.duration ?? 0), 0),
  );

  const genres = createMemo(() => {
    const current = album();
    if (!current) return [];
    const names = current.genres?.map((genre) => genre.name).filter(Boolean);
    if (names?.length) return [...new Set(names)];
    return current.genre ? [current.genre] : [];
  });

  /** Songs split per disc, only when the album really has more than one. */
  const discs = createMemo(() => {
    const groups = new Map<number, Song[]>();
    for (const song of songs()) {
      const disc = song.discNumber || 1;
      const group = groups.get(disc);
      if (group) group.push(song);
      else groups.set(disc, [song]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([disc, list]) => ({ disc, songs: list }));
  });
  const multiDisc = () => discs().length > 1;

  // Soft light in the cover's own color, shining down from the top.
  const [glow, setGlow] = createSignal<string | null>(null);
  createEffect(
    on(
      () => {
        const current = album();
        return current ? (current.coverArt ?? current.id) : undefined;
      },
      (coverId) => {
        setGlow(null);
        const client = servers.client();
        if (!client || !coverId) return;
        let cancelled = false;
        onCleanup(() => (cancelled = true));
        void coverColor(client, coverId).then((color) => {
          if (!cancelled && color) setGlow(glowHsl(color));
        });
      },
    ),
  );

  function playAll(shuffle = false) {
    if (!songs().length) return;
    player.playNow(songs(), 0, album()?.name);
    if (shuffle && !player.state.shuffle) player.toggleShuffle();
  }

  return (
    <div class="relative isolate">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] overflow-hidden transition-opacity duration-700 ease-out"
        style={{ opacity: glow() ? 1 : 0 }}
      >
        <Show when={glow()}>
          {(hsl) => (
            <>
              {/* Wide wash from the top edge. */}
              <div
                class="absolute inset-0 opacity-45 dark:opacity-60"
                style={{
                  background: `radial-gradient(ellipse 85% 75% at 50% -10%, hsl(${hsl()} / 0.55), hsl(${hsl()} / 0.18) 45%, transparent 75%)`,
                }}
              />
              {/* Brighter core over the cover, like a light just above it. */}
              <div
                class="absolute inset-0 opacity-40 dark:opacity-50"
                style={{
                  background: `radial-gradient(ellipse 40% 45% at 22% -8%, hsl(${hsl()} / 0.5), transparent 70%)`,
                }}
              />
            </>
          )}
        </Show>
      </div>

      <Page class="@container">
        <Show
          when={!data.loading}
          fallback={
            <div class="flex flex-col items-center gap-6 @2xl:flex-row @2xl:gap-8">
              <Skeleton class="size-52 shrink-0 rounded-2xl @2xl:size-56" />
              <div class="w-full flex-1 space-y-3 py-2">
                <Skeleton class="mx-auto h-3 w-24 @2xl:mx-0" />
                <Skeleton class="mx-auto h-10 w-2/3 @2xl:mx-0" />
                <Skeleton class="mx-auto h-4 w-40 @2xl:mx-0" />
                <Skeleton class="mx-auto h-3 w-1/3 @2xl:mx-0" />
              </div>
            </div>
          }
        >
          <Show
            when={!data.error && album()}
            fallback={
              <ErrorState
                message={t(
                  (data.error
                    ? subsonicErrorKey(data.error)
                    : "album.notFound") as MessageKey,
                )}
                onRetry={() => reloadAlbum()}
                retryLabel={t("action.retry")}
              />
            }
          >
            {/* ---------------------------------------------------- header */}
            <header class="flex flex-col items-center gap-6 @2xl:flex-row @2xl:gap-8">
              <div
                class="cover-frame shrink-0 rounded-2xl"
                style={{ "box-shadow": "0 12px 32px -12px rgb(0 0 0 / 0.35)" }}
              >
                <Cover
                  coverArtId={album()!.coverArt ?? album()!.id}
                  size={500}
                  alt={album()!.name}
                  class="glass-cover size-52 rounded-2xl @2xl:size-56"
                  iconClass="size-12"
                  zoomable
                />
              </div>

              <div class="flex w-full min-w-0 flex-1 flex-col items-center gap-2 text-center @2xl:items-start @2xl:text-left">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("album.label")}
                </span>

                <h1 class="w-full text-pretty text-3xl font-extrabold leading-[1.1] tracking-tight hyphens-auto [overflow-wrap:break-word] @2xl:text-4xl @5xl:text-5xl">
                  {album()!.name}
                </h1>

                <Show
                  when={album()!.artistId}
                  fallback={
                    <p class="text-base font-semibold">
                      {album()!.artist ?? t("common.unknownArtist")}
                    </p>
                  }
                >
                  <A
                    href={`/artist/${album()!.artistId}`}
                    class="text-base font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    {album()!.artist ?? t("common.unknownArtist")}
                  </A>
                </Show>

                <MetaLine
                  class="justify-center text-sm text-muted-foreground @2xl:justify-start"
                  parts={[
                    formatYear(album()!.year),
                    t("album.songCount", { count: songs().length }),
                    totalDuration() > 0 && formatTime(totalDuration()),
                    multiDisc() && t("album.discCount", { count: discs().length }),
                    (album()!.playCount ?? 0) > 0 &&
                      t("album.playCount", { count: album()!.playCount! }),
                  ]}
                />

                {/* --------------------------------------------------- actions */}
                <div class="mt-3 flex w-full flex-col gap-3 @2xl:mt-4 @2xl:w-auto @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:gap-x-4 @2xl:gap-y-2">
                  <div class="flex w-full items-center gap-2 @2xl:w-auto">
                    <Button
                      size="lg"
                      class="flex-1 rounded-full px-6 shadow-md @2xl:flex-none"
                      onClick={() => playAll(false)}
                      disabled={!songs().length}
                    >
                      <Play class="size-4 fill-current" />
                      {t("album.playAll")}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      class="flex-1 rounded-full bg-background/40 px-5 backdrop-blur-sm @2xl:flex-none"
                      onClick={() => playAll(true)}
                      disabled={!songs().length}
                    >
                      <Shuffle class="size-4" />
                      {t("album.shufflePlay")}
                    </Button>
                  </div>

                  <div class="flex items-center justify-center gap-1 @2xl:justify-start">
                    <AlbumLikeButton album={album()!} songs={songs()} />
                    <DownloadAllButton songs={songs()} />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        as={Button}
                        variant="ghost"
                        size="icon"
                        aria-label={t("action.more")}
                        title={t("action.more")}
                      >
                        <Ellipsis class="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          disabled={!songs().length}
                          onSelect={() => player.playNext(songs())}
                        >
                          <ListEnd class="size-4" />
                          {t("action.playNext")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!songs().length}
                          onSelect={() => player.addToQueue(songs())}
                        >
                          <ListPlus class="size-4" />
                          {t("action.addToQueue")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!songs().length}
                          onSelect={() => playlists.openAddTo(songs())}
                        >
                          <ListMusic class="size-4" />
                          {t("playlist.addTo.action")}
                        </DropdownMenuItem>
                        <Show when={album()!.artistId}>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => navigate(`/artist/${album()!.artistId}`)}
                          >
                            <Mic2 class="size-4" />
                            {t("action.goToArtist")}
                          </DropdownMenuItem>
                        </Show>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <span aria-hidden="true" class="mx-2 h-5 w-px bg-border" />
                    <RatingStars item={album()!} />
                  </div>
                </div>
              </div>
            </header>

            {/* ---------------------------------------------------- genres */}
            <Show when={genres().length > 0}>
              <div class="mt-4 flex flex-wrap items-center gap-1.5 px-1.5 @2xl:mt-5 sm:px-2">
                <For each={genres()}>
                  {(genre) => (
                    <A
                      href={genreHref(genre)}
                      class="inline-flex max-w-full items-center gap-1 rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground"
                    >
                      <Disc3 class="size-3 shrink-0" />
                      <span class="truncate">{genre}</span>
                    </A>
                  )}
                </For>
              </div>
            </Show>

            {/* ---------------------------------------------------- tracks */}
            <div class={genres().length > 0 ? "mt-3" : "mt-6 @2xl:mt-8"}>
              <Show
                when={songs().length > 0}
                fallback={
                  <p class="text-sm text-muted-foreground">{t("common.empty")}</p>
                }
              >
                <Show
                  when={multiDisc()}
                  fallback={
                    <TrackList
                      songs={songs()}
                      sourceName={album()!.name}
                      trackNumbers
                    />
                  }
                >
                  <div class="flex flex-col gap-5">
                    <For each={discs()}>
                      {(disc) => (
                        <section>
                          <h2 class="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Disc3 class="size-3.5" />
                            {t("album.disc", { n: disc.disc })}
                          </h2>
                          <TrackList
                            songs={disc.songs}
                            context={songs()}
                            sourceName={album()!.name}
                            trackNumbers
                          />
                        </section>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>
        </Show>
      </Page>
    </div>
  );
}
