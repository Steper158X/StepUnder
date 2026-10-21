import { createResource, createSignal, Show } from "solid-js";
import { LoaderCircle, Music, Play, Shuffle } from "lucide-solid";
import type { Album } from "~/lib/types";
import type { SubsonicClient } from "~/lib/subsonic";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Page, PageHeader, Section } from "~/components/layout-bits";
import { AlbumRow } from "~/components/album-card";
import { EmptyState, ErrorState } from "~/components/common";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/select";

interface HomeData {
  newAlbums: Album[];
  recent: Album[];
  random: Album[];
  starred: Album[];
}

async function loadHome(client: SubsonicClient): Promise<HomeData> {
  const results = await Promise.allSettled([
    client.getAlbumList2("newest", 18, 0),
    client.getAlbumList2("recent", 18, 0),
    client.getAlbumList2("random", 18, 0),
    client.getStarred2(),
  ]);

  const albums = (index: number): Album[] => {
    const result = results[index];
    return result.status === "fulfilled" ? (result.value as Album[]) : [];
  };
  const starred = results[3];

  return {
    newAlbums: albums(0),
    recent: albums(1),
    random: albums(2),
    starred:
      starred.status === "fulfilled"
        ? ((starred.value as { albums?: Album[] }).albums ?? [])
        : [],
  };
}

function RowSkeleton() {
  return (
    <div class="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }).map(() => (
        <div class="w-40 shrink-0 space-y-2">
          <Skeleton class="aspect-square w-full rounded-lg" />
          <Skeleton class="h-3 w-3/4" />
          <Skeleton class="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const servers = useServers();
  const player = usePlayer();
  const [playingRandom, setPlayingRandom] = createSignal(false);

  const [data, { refetch: reloadHome }] = createResource(
    () => servers.client() ?? undefined,
    (client) => loadHome(client),
  );

  async function playRandom() {
    const client = servers.client();
    if (!client || playingRandom()) return;
    setPlayingRandom(true);
    try {
      const songs = await client.getRandomSongs(50);
      if (!songs.length) return;
      player.playNow(songs, 0, t("home.random"));
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setPlayingRandom(false);
    }
  }

  const isEmpty = () => {
    const value = data();
    if (!value) return false;
    return (
      !value.newAlbums.length &&
      !value.recent.length &&
      !value.random.length &&
      !value.starred.length
    );
  };

  return (
    <Page>
      <PageHeader
        title={servers.activeServer()?.name ?? t("nav.home")}
        subtitle={t("app.tagline")}
        actions={
          <Button
            variant="outline"
            onClick={() => void playRandom()}
            disabled={playingRandom()}
          >
            <Show
              when={!playingRandom()}
              fallback={<LoaderCircle class="size-4 animate-spin" />}
            >
              <Shuffle class="size-4" />
            </Show>
            {t("home.random")}
          </Button>
        }
      />

      <Show
        when={!data.loading}
        fallback={
          <div class="space-y-8">
            <div class="space-y-3">
              <Skeleton class="h-5 w-40" />
              <RowSkeleton />
            </div>
            <div class="space-y-3">
              <Skeleton class="h-5 w-36" />
              <RowSkeleton />
            </div>
          </div>
        }
      >
        <Show
          when={!data.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(data.error) as MessageKey)}
              onRetry={() => reloadHome()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={!isEmpty()}
            fallback={
              <EmptyState
                icon={<Music class="size-5" />}
                title={t("common.empty")}
                description={t("setup.firstRunHint")}
              >
                <Button size="sm" onClick={() => void playRandom()}>
                  <Play class="size-4 fill-current" />
                  {t("action.play")}
                </Button>
              </EmptyState>
            }
          >
            <div class="space-y-8">
              <Show when={data()!.newAlbums.length}>
                <Section title={t("home.recentlyAdded")} href="/albums">
                  <AlbumRow albums={data()!.newAlbums} />
                </Section>
              </Show>

              <Show when={data()!.recent.length}>
                <Section title={t("home.recentlyPlayed")} href="/albums">
                  <AlbumRow albums={data()!.recent} />
                </Section>
              </Show>

              <Show when={data()!.starred.length}>
                <Section title={t("home.starred")} href="/albums">
                  <AlbumRow albums={data()!.starred} />
                </Section>
              </Show>

              <Show when={data()!.random.length}>
                <Section title={t("home.random")}>
                  <AlbumRow albums={data()!.random} />
                </Section>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
