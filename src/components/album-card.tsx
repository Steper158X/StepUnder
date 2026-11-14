import { A, useNavigate } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { Disc3, ListEnd, ListMusic, ListPlus, LoaderCircle, Play } from "lucide-solid";
import type { Album, Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { usePlaylists } from "~/state/playlists";
import { useDownloads } from "~/state/downloads";
import { downloadOnStar } from "~/state/settings";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Cover } from "~/components/common";
import { RatingSubmenu, StarMenuItem } from "~/components/annotations";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { cn } from "~/lib/utils";

export function AlbumCard(props: { album: Album; class?: string; size?: number }) {
  const servers = useServers();
  const player = usePlayer();
  const playlists = usePlaylists();
  const downloads = useDownloads();
  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);

  /** Loads the album's songs and hands them to `action`; shows errors as toasts. */
  async function withSongs(action: (songs: Song[]) => void) {
    const client = servers.client();
    if (!client || busy()) return;
    setBusy(true);
    try {
      const { songs } = await client.getAlbum(props.album.id);
      if (songs.length) action(songs);
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  function playAlbum(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    void withSongs((songs) => player.playNow(songs, 0, props.album.name));
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        data-allow-context-menu
        as="div"
        class={cn("glass-tile group w-40 shrink-0", props.class)}
      >
        <div class="glass-cover relative isolate aspect-square overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-black/5 [backface-visibility:hidden] [transform:translateZ(0)]">
          <A href={`/album/${props.album.id}`} class="block size-full">
            <Cover
              coverArtId={props.album.coverArt ?? props.album.id}
              size={props.size ?? 320}
              alt={props.album.name}
              class="size-full transition-transform duration-300 [backface-visibility:hidden] will-change-transform group-hover:scale-[1.03]"
              iconClass="size-8"
            />
          </A>
          <button
            type="button"
            onClick={(event) => void playAlbum(event)}
            class="glass-button absolute bottom-2 right-2 z-[2] flex size-9 translate-y-1.5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-200 hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
            aria-label={`${t("action.play")} ${props.album.name}`}
          >
            <Show
              when={!busy()}
              fallback={<LoaderCircle class="size-4 animate-spin" />}
            >
              <Play class="size-4 fill-current" />
            </Show>
          </button>
        </div>
        <A href={`/album/${props.album.id}`} class="mt-2 block">
          <p class="truncate text-sm font-medium leading-tight" title={props.album.name}>
            {props.album.name}
          </p>
          <p class="mt-0.5 truncate text-xs text-muted-foreground">
            {props.album.artist ?? t("common.unknownArtist")}
          </p>
        </A>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() =>
            void withSongs((songs) => player.playNow(songs, 0, props.album.name))
          }
        >
          <Play class="size-4" />
          {t("action.play")}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void withSongs((songs) => player.playNext(songs))}
        >
          <ListEnd class="size-4" />
          {t("action.playNext")}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void withSongs((songs) => player.addToQueue(songs))}
        >
          <ListPlus class="size-4" />
          {t("action.addToQueue")}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => void withSongs((songs) => playlists.openAddTo(songs))}
        >
          <ListMusic class="size-4" />
          {t("playlist.addTo.action")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <StarMenuItem
          item={props.album}
          onStarred={() => {
            if (downloadOnStar()) {
              void withSongs((songs) => downloads.download(songs));
            }
          }}
        />
        <RatingSubmenu item={props.album} />
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => navigate(`/album/${props.album.id}`)}>
          <Disc3 class="size-4" />
          {t("action.goToAlbum")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function AlbumRow(props: { albums: Album[]; class?: string }) {
  return (
    <div class={cn("glass-row flex gap-4 overflow-x-auto pb-2", props.class)}>
      <For each={props.albums}>{(album) => <AlbumCard album={album} />}</For>
    </div>
  );
}

export function AlbumGrid(props: { albums: Album[]; class?: string }) {
  return (
    <div
      class={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4 gap-y-6",
        props.class,
      )}
    >
      <For each={props.albums}>
        {(album) => <AlbumCard album={album} class="w-full" />}
      </For>
    </div>
  );
}
