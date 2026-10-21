import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { Heart, Play, RefreshCw, Shuffle } from "lucide-solid";
import type { Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { AlbumGrid } from "~/components/album-card";
import { TrackList } from "~/components/track-row";
import { ArtistTile } from "~/routes/artists";
import { EmptyState, ErrorState, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type Tab = "songs" | "albums" | "artists";

const tabs: Array<{ value: Tab; key: MessageKey }> = [
  { value: "songs", key: "favorites.songs" },
  { value: "albums", key: "favorites.albums" },
  { value: "artists", key: "favorites.artists" },
];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function FavoritesPage() {
  const servers = useServers();
  const player = usePlayer();
  const [tab, setTab] = createSignal<Tab>("songs");

  const [starred, { refetch }] = createResource(
    () => servers.client() ?? undefined,
    (client) => client.getStarred2(),
  );

  const songs = createMemo<Song[]>(() => starred()?.songs ?? []);
  const albums = createMemo(() => starred()?.albums ?? []);
  const artists = createMemo(() => starred()?.artists ?? []);

  const countOf = (value: Tab): number => {
    if (value === "songs") return songs().length;
    if (value === "albums") return albums().length;
    return artists().length;
  };

  function playSongs(list: Song[]) {
    if (!list.length) return;
    player.playNow(list, 0, t("favorites.title"));
  }

  return (
    <Page>
      <PageHeader
        title={t("favorites.title")}
        subtitle={t("favorites.subtitle")}
        actions={
          <div class="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!songs().length}
              onClick={() => playSongs(songs())}
            >
              <Play class="size-4 fill-current" />
              {t("action.play")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!songs().length}
              onClick={() => playSongs(shuffled(songs()))}
            >
              <Shuffle class="size-3.5" />
              {t("action.shuffle")}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => void refetch()}
              disabled={starred.loading}
              aria-label={t("action.refresh")}
              title={t("action.refresh")}
            >
              <RefreshCw
                class={cn("size-3.5", starred.loading && "animate-spin")}
              />
            </Button>
          </div>
        }
      />

      <div class="mb-5 flex flex-wrap gap-1.5">
        <For each={tabs}>
          {(item) => (
            <Button
              variant={tab() === item.value ? "secondary" : "ghost"}
              size="sm"
              class={cn(tab() !== item.value && "text-muted-foreground")}
              onClick={() => setTab(item.value)}
            >
              {t(item.key)}
              <span class="text-[11px] tabular-nums opacity-70">
                {countOf(item.value)}
              </span>
            </Button>
          )}
        </For>
      </div>

      <Show
        when={!starred.loading}
        fallback={
          <div class="flex justify-center py-14">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!starred.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(starred.error) as MessageKey)}
              onRetry={() => void refetch()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={countOf(tab()) > 0}
            fallback={
              <EmptyState
                icon={<Heart class="size-5" />}
                title={t("favorites.empty")}
                description={t("favorites.emptyHint")}
              />
            }
          >
            <div class="space-y-8">
              <Show when={tab() === "songs"}>
                <TrackList
                  songs={songs()}
                  sourceName={t("favorites.title")}
                  showAlbum
                  showCover
                />
              </Show>

              <Show when={tab() === "albums"}>
                <AlbumGrid albums={albums()} />
              </Show>

              <Show when={tab() === "artists"}>
                <div class="flex flex-wrap gap-x-6 gap-y-7">
                  <For each={artists()}>
                    {(artist) => <ArtistTile artist={artist} />}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
