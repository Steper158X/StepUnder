import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { ListMusic, Pencil, Plus, Trash2 } from "lucide-solid";
import type { Playlist } from "~/lib/types";
import { usePlaylists } from "~/state/playlists";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { Cover, EmptyState, ErrorState, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";

function PlaylistCard(props: { playlist: Playlist }) {
  const playlists = usePlaylists();

  const card = () => (
    <A
      href={`/playlist/${props.playlist.id}`}
      class="glass-tile group block rounded-lg p-2 transition-colors hover:bg-accent/50"
    >
      <Cover
        coverArtId={props.playlist.coverArt ?? props.playlist.id}
        cacheKey={playlists.coverKey(props.playlist.id)}
        size={300}
        alt={props.playlist.name}
        class="glass-cover aspect-square w-full rounded-lg shadow-sm"
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

  return (
    <Show when={playlists.canEdit(props.playlist)} fallback={card()}>
      <ContextMenu>
        <ContextMenuTrigger data-allow-context-menu>{card()}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => playlists.openEdit(props.playlist)}>
            <Pencil class="size-4" />
            {t("playlist.edit")}
          </ContextMenuItem>
          <ContextMenuItem
            class="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
            onSelect={() => playlists.openDelete(props.playlist)}
          >
            <Trash2 class="size-4" />
            {t("playlist.delete.action")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Show>
  );
}

function CreatePlaylistCard() {
  const playlists = usePlaylists();
  return (
    <button
      type="button"
      onClick={() => playlists.openCreate()}
      class="group block rounded-lg p-2 text-left transition-colors hover:bg-accent/50"
    >
      <div class="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors group-hover:border-primary/60 group-hover:text-foreground">
        <Plus class="size-8" />
      </div>
      <p class="mt-2 truncate text-sm font-medium">{t("playlists.create")}</p>
      <p class="truncate text-xs text-muted-foreground">
        {t("playlists.createHint")}
      </p>
    </button>
  );
}

export default function PlaylistsPage() {
  const playlists = usePlaylists();

  return (
    <Page>
      <PageHeader
        title={t("playlists.title")}
        actions={
          <Button onClick={() => playlists.openCreate()}>
            <Plus class="size-4" />
            {t("playlists.create")}
          </Button>
        }
      />

      <Show
        when={!playlists.loading() || playlists.playlists().length}
        fallback={
          <div class="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!playlists.error()}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(playlists.error()) as MessageKey)}
              onRetry={() => playlists.reload()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={playlists.playlists().length}
            fallback={
              <EmptyState
                icon={<ListMusic class="size-5" />}
                title={t("playlists.empty")}
                description={t("playlists.emptyHint")}
              >
                <Button onClick={() => playlists.openCreate()}>
                  <Plus class="size-4" />
                  {t("playlists.create")}
                </Button>
              </EmptyState>
            }
          >
            <div class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
              <CreatePlaylistCard />
              <For each={playlists.playlists()}>
                {(playlist) => <PlaylistCard playlist={playlist} />}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
