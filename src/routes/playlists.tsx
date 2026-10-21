import { A } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import { ListMusic } from "lucide-solid";
import type { Playlist } from "~/lib/types";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { Cover, EmptyState, ErrorState, Spinner } from "~/components/common";

function PlaylistCard(props: { playlist: Playlist }) {
  return (
    <A
      href={`/playlist/${props.playlist.id}`}
      class="group block rounded-lg p-2 transition-colors hover:bg-accent/50"
    >
      <Cover
        coverArtId={props.playlist.coverArt ?? props.playlist.id}
        size={300}
        alt={props.playlist.name}
        class="aspect-square w-full rounded-lg shadow-sm"
        iconClass="size-8"
      />
      <p class="mt-2 truncate text-sm font-medium" title={props.playlist.name}>
        {props.playlist.name}
      </p>
      <p class="truncate text-xs text-muted-foreground">
        {props.playlist.owner
          ? t("playlists.owner", { owner: props.playlist.owner })
          : t("nav.playlists")}
        <span class="px-1">•</span>
        {t("playlist.songCount", { count: props.playlist.songCount ?? 0 })}
      </p>
    </A>
  );
}

export default function PlaylistsPage() {
  const servers = useServers();

  const [playlists, { refetch: reloadPlaylists }] = createResource(
    () => servers.client() ?? undefined,
    (client) => client.getPlaylists(),
  );

  return (
    <Page>
      <PageHeader title={t("playlists.title")} />

      <Show
        when={!playlists.loading}
        fallback={
          <div class="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!playlists.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(playlists.error) as MessageKey)}
              onRetry={() => reloadPlaylists()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={playlists()?.length}
            fallback={
              <EmptyState
                icon={<ListMusic class="size-5" />}
                title={t("playlists.empty")}
              />
            }
          >
            <div class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
              {playlists()!.map((playlist) => (
                <PlaylistCard playlist={playlist} />
              ))}
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
