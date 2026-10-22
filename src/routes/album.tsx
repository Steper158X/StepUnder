import { A, useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";
import { Disc3, Play, Shuffle } from "lucide-solid";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { formatTime, formatYear } from "~/lib/format";
import { Cover, ErrorState } from "~/components/common";
import { Page } from "~/components/layout-bits";
import { TrackList } from "~/components/track-row";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/select";

export default function AlbumPage() {
  const params = useParams();
  const servers = useServers();
  const player = usePlayer();

  const [data, { refetch: reloadAlbum }] = createResource(
    () => (servers.client() && params.id ? params.id : undefined),
    (id) => servers.client()!.getAlbum(id),
  );

  const album = () => data()?.album;
  const songs = () => data()?.songs ?? [];
  const totalDuration = createMemo(() =>
    songs().reduce((total, song) => total + (song.duration ?? 0), 0),
  );

  function playAll(shuffle = false) {
    if (!songs().length) return;
    player.playNow(songs(), 0, album()?.name);
    if (shuffle && !player.state.shuffle) player.toggleShuffle();
  }

  return (
    <Page class="@container">
      <Show
        when={!data.loading}
        fallback={
          <div class="flex flex-col items-center gap-5 @2xl:flex-row @2xl:items-end @2xl:gap-6">
            <Skeleton class="size-40 shrink-0 rounded-xl @2xl:size-44" />
            <div class="w-full flex-1 space-y-3 py-2 @2xl:py-4">
              <Skeleton class="mx-auto h-3 w-20 @2xl:mx-0" />
              <Skeleton class="mx-auto h-8 w-2/3 @2xl:mx-0" />
              <Skeleton class="mx-auto h-3 w-1/2 @2xl:mx-0" />
              <Skeleton class="mx-auto h-9 w-40 @2xl:mx-0" />
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
          <div class="flex flex-col items-center gap-5 @2xl:flex-row @2xl:items-end @2xl:gap-6">
            <Cover
              coverArtId={album()!.coverArt ?? album()!.id}
              size={400}
              alt={album()!.name}
              class="size-40 shrink-0 rounded-xl shadow-lg @2xl:size-44"
              iconClass="size-10"
              zoomable
            />
            <div class="flex w-full min-w-0 flex-1 flex-col items-center gap-2.5 text-center @2xl:items-start @2xl:justify-end @2xl:gap-3 @2xl:text-left">
              <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground @2xl:text-xs">
                {t("nav.albums")}
              </p>
              <h1 class="text-balance text-2xl font-bold leading-tight [overflow-wrap:anywhere] @2xl:text-3xl">
                {album()!.name}
              </h1>
              <p class="flex flex-wrap items-center justify-center text-sm text-muted-foreground @2xl:justify-start">
                <Show when={album()!.artistId}>
                  <A
                    href={`/artist/${album()!.artistId}`}
                    class="font-medium text-foreground hover:underline"
                  >
                    {album()!.artist ?? t("common.unknownArtist")}
                  </A>
                  <span class="px-1.5">•</span>
                </Show>
                <Show when={formatYear(album()!.year)}>
                  <span>{formatYear(album()!.year)}</span>
                  <span class="px-1.5">•</span>
                </Show>
                <span>{t("album.songCount", { count: songs().length })}</span>
                <Show when={totalDuration() > 0}>
                  <span class="px-1.5">•</span>
                  <span>{formatTime(totalDuration())}</span>
                </Show>
              </p>
              <div class="flex w-full items-center gap-2 pt-1 @2xl:w-auto">
                <Button
                  class="flex-1 @2xl:flex-none"
                  onClick={() => playAll(false)}
                  disabled={!songs().length}
                >
                  <Play class="size-4 fill-current" />
                  {t("album.playAll")}
                </Button>
                <Button
                  variant="outline"
                  class="flex-1 @2xl:flex-none"
                  onClick={() => playAll(true)}
                  disabled={!songs().length}
                >
                  <Shuffle class="size-4" />
                  {t("album.shufflePlay")}
                </Button>
              </div>
            </div>
          </div>

          <div class="mt-6 @2xl:mt-8">
            <Show
              when={songs().length > 0}
              fallback={
                <p class="text-sm text-muted-foreground">
                  {t("common.empty")}
                </p>
              }
            >
              <TrackList songs={songs()} sourceName={album()!.name} />
            </Show>
          </div>

          <Show when={album()!.genre}>
            <div class="mt-6 flex items-center gap-2 text-xs text-muted-foreground sm:mt-8">
              <Disc3 class="size-3.5 shrink-0" />
              <span class="min-w-0 truncate">{album()!.genre}</span>
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
