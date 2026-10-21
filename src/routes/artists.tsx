import { A } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import { Users } from "lucide-solid";
import type { Artist } from "~/lib/types";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { initials } from "~/lib/format";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { EmptyState, ErrorState, Spinner } from "~/components/common";

export function ArtistTile(props: { artist: Artist }) {
  return (
    <A
      href={`/artist/${props.artist.id}`}
      class="group flex w-36 flex-col items-center gap-2 text-center"
    >
      <div class="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-secondary via-muted to-secondary/70 text-2xl font-semibold text-muted-foreground shadow-sm ring-1 ring-black/5 transition-all group-hover:ring-2 group-hover:ring-primary/40">
        {initials(props.artist.name)}
      </div>
      <p class="w-full truncate text-sm font-medium" title={props.artist.name}>
        {props.artist.name}
      </p>
      <p class="text-xs text-muted-foreground">
        {props.artist.albumCount ?? 0} {t("units.albums")}
      </p>
    </A>
  );
}

export default function ArtistsPage() {
  const servers = useServers();

  const [artists, { refetch: reloadArtists }] = createResource(
    () => servers.client() ?? undefined,
    (client) => client.getArtists(),
  );

  return (
    <Page>
      <PageHeader title={t("artists.title")} />

      <Show
        when={!artists.loading}
        fallback={
          <div class="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!artists.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(artists.error) as MessageKey)}
              onRetry={() => reloadArtists()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={artists()?.length}
            fallback={
              <EmptyState
                icon={<Users class="size-5" />}
                title={t("artists.empty")}
              />
            }
          >
            <div class="flex flex-wrap gap-x-6 gap-y-7">
              {artists()!.map((artist) => (
                <ArtistTile artist={artist} />
              ))}
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
