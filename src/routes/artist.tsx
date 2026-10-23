import { useParams } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import { Users } from "lucide-solid";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page } from "~/components/layout-bits";
import { AlbumGrid } from "~/components/album-card";
import { ArtistAvatar, ErrorState, Spinner } from "~/components/common";
import { TrackList } from "~/components/track-row";
import { Section } from "~/components/layout-bits";

export default function ArtistPage() {
  const params = useParams();
  const servers = useServers();

  const [data, { refetch: reloadArtist }] = createResource(
    () => (servers.client() && params.id ? params.id : undefined),
    (id) => servers.client()!.getArtist(id),
  );

  const [topSongs] = createResource(
    () => data()?.artist.name,
    (name) => servers.client()!.getTopSongs(name, 15),
  );

  return (
    <Page>
      <Show
        when={!data.loading}
        fallback={
          <div class="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!data.error && data()?.artist}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(data.error) as MessageKey)}
              onRetry={() => reloadArtist()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <div class="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <ArtistAvatar
              id={data()!.artist.id}
              name={data()!.artist.name}
              coverArt={data()!.artist.coverArt}
              size={400}
              class="size-32 text-3xl shadow ring-1 ring-black/5"
            />
            <div class="min-w-0">
              <p class="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:justify-start">
                <Users class="size-3.5" />
                {t("nav.artists")}
              </p>
              <h1 class="mt-1 truncate text-2xl font-bold sm:text-3xl">
                {data()!.artist.name}
              </h1>
              <p class="mt-1 text-sm text-muted-foreground">
                {data()!.albums.length} {t("units.albums")}
              </p>
            </div>
          </div>

          <Show when={data()!.albums.length > 0}>
            <Section title={t("artists.albums")}>
              <AlbumGrid albums={data()!.albums} />
            </Section>
          </Show>

          <Show when={(topSongs() ?? []).length > 0}>
            <Section title={t("artists.topSongs")} class="mt-8">
              <TrackList
                songs={topSongs()!}
                sourceName={data()!.artist.name}
                showAlbum
                showCover
              />
            </Section>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
