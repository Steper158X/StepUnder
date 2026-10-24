import { A } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { LoaderCircle, Play } from "lucide-solid";
import type { Album } from "~/lib/types";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Cover } from "~/components/common";
import { cn } from "~/lib/utils";

export function AlbumCard(props: { album: Album; class?: string; size?: number }) {
  const servers = useServers();
  const player = usePlayer();
  const [busy, setBusy] = createSignal(false);

  async function playAlbum(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const client = servers.client();
    if (!client || busy()) return;
    setBusy(true);
    try {
      const { songs } = await client.getAlbum(props.album.id);
      player.playNow(songs, 0, props.album.name);
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class={cn("glass-tile group w-40 shrink-0", props.class)}>
      <div class="glass-cover relative aspect-square overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-black/5">
        <A href={`/album/${props.album.id}`} class="block size-full">
          <Cover
            coverArtId={props.album.coverArt ?? props.album.id}
            size={props.size ?? 320}
            alt={props.album.name}
            class="size-full transition-transform duration-300 group-hover:scale-[1.03]"
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
    </div>
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
