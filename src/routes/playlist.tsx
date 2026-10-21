import { useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";
import { ListMusic, Play, Shuffle } from "lucide-solid";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { formatTime } from "~/lib/format";
import { Cover, ErrorState } from "~/components/common";
import { Page } from "~/components/layout-bits";
import { TrackList } from "~/components/track-row";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/select";

export default function PlaylistPage() {
  const params = useParams();
  const servers = useServers();
  const player = usePlayer();

  const [data, { refetch: reloadPlaylist }] = createResource(
    () => (servers.client() && params.id ? params.id : undefined),
    (id) => servers.client()!.getPlaylist(id),
  );

  const playlist = () => data()?.playlist;
  const songs = () => data()?.songs ?? [];
  const totalDuration = createMemo(() =>
    songs().reduce((total, song) => total + (song.duration ?? 0), 0),
  );

  function playAll(shuffle = false) {
    if (!songs().length) return;
    player.playNow(songs(), 0, playlist()?.name);
    if (shuffle && !player.state.shuffle) player.toggleShuffle();
  }

  return (
    <Page>
      <Show
        when={!data.loading}
        fallback={
          <div class="flex flex-col gap-6 sm:flex-row">
            <Skeleton class="size-44 shrink-0 rounded-xl" />
            <div class="flex-1 space-y-3 py-4">
              <Skeleton class="h-3 w-24" />
              <Skeleton class="h-8 w-2/3" />
              <Skeleton class="h-3 w-1/2" />
            </div>
          </div>
        }
      >
        <Show
          when={!data.error && playlist()}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(data.error) as MessageKey)}
              onRetry={() => reloadPlaylist()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <div class="flex flex-col gap-6 sm:flex-row">
            <Cover
              coverArtId={playlist()!.coverArt ?? playlist()!.id}
              size={400}
              alt={playlist()!.name}
              class="size-44 shrink-0 rounded-xl shadow-lg"
              iconClass="size-10"
            />
            <div class="flex min-w-0 flex-1 flex-col justify-end gap-3">
              <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <ListMusic class="size-3.5" />
                {t("nav.playlists")}
              </p>
              <h1 class="text-2xl font-bold leading-tight sm:text-3xl">
                {playlist()!.name}
              </h1>
              <p class="text-sm text-muted-foreground">
                <Show when={playlist()!.owner}>
                  <span>{t("playlists.owner", { owner: playlist()!.owner! })}</span>
                  <span class="px-1.5">•</span>
                </Show>
                <span>{t("playlist.songCount", { count: songs().length })}</span>
                <Show when={totalDuration() > 0}>
                  <span class="px-1.5">•</span>
                  <span>{formatTime(totalDuration())}</span>
                </Show>
              </p>
              <div class="flex items-center gap-2 pt-1">
                <Button onClick={() => playAll(false)} disabled={!songs().length}>
                  <Play class="size-4 fill-current" />
                  {t("playlist.playAll")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => playAll(true)}
                  disabled={!songs().length}
                >
                  <Shuffle class="size-4" />
                  {t("album.shufflePlay")}
                </Button>
              </div>
            </div>
          </div>

          <div class="mt-8">
            <Show
              when={songs().length > 0}
              fallback={
                <p class="text-sm text-muted-foreground">{t("common.empty")}</p>
              }
            >
              <TrackList
                songs={songs()}
                sourceName={playlist()!.name}
                showAlbum
                showCover
              />
            </Show>
          </div>
        </Show>
      </Show>
    </Page>
  );
}
