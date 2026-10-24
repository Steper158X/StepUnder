import { useParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import {
  Ellipsis,
  Globe,
  ListMusic,
  ListPlus,
  Lock,
  Pencil,
  Play,
  Shuffle,
  Trash2,
} from "lucide-solid";
import type { Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import { usePlaylists } from "~/state/playlists";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { formatTime } from "~/lib/format";
import { toast } from "~/components/toaster";
import { Cover, EmptyState, ErrorState } from "~/components/common";
import { Page } from "~/components/layout-bits";
import { TrackList } from "~/components/track-row";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export default function PlaylistPage() {
  const params = useParams();
  const servers = useServers();
  const playlists = usePlaylists();
  const player = usePlayer();

  const [data, { refetch: reloadPlaylist }] = createResource(
    () =>
      servers.client() && params.id
        ? { id: params.id, revision: playlists.revision() }
        : undefined,
    ({ id }) => servers.client()!.getPlaylist(id),
  );

  // Local copy so reordering and removing feel instant; the server catches up.
  const [songs, setSongs] = createSignal<Song[]>([]);
  createEffect(() => setSongs(data.latest?.songs ?? []));

  const playlist = () => data.latest?.playlist;
  const editable = () => playlists.canEdit(playlist());
  const totalDuration = createMemo(() =>
    songs().reduce((total, song) => total + (song.duration ?? 0), 0),
  );

  // Edits run one after another so index-based removals stay correct.
  let pending: Promise<unknown> = Promise.resolve();
  function persist(previous: Song[], run: () => Promise<void>) {
    pending = pending.then(run).catch((error) => {
      setSongs(previous);
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    });
  }

  function moveSong(from: number, to: number) {
    const id = playlist()?.id;
    if (!id) return;
    const previous = songs();
    const next = [...previous];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSongs(next);
    const ids = next.map((song) => song.id);
    persist(previous, () =>
      servers.client()!.replacePlaylistSongs(id, previous.length, ids),
    );
  }

  function removeSong(index: number) {
    const id = playlist()?.id;
    if (!id) return;
    const previous = songs();
    const removed = previous[index];
    setSongs(previous.filter((_, position) => position !== index));
    persist(previous, async () => {
      await servers
        .client()!
        .updatePlaylist(id, { songIndexesToRemove: [index] });
      toast(
        t("playlist.toast.removed", { title: removed?.title ?? "" }),
        undefined,
        "success",
      );
      playlists.reload();
    });
  }

  function playAll(shuffle = false) {
    if (!songs().length) return;
    player.playNow(songs(), 0, playlist()?.name);
    if (shuffle && !player.state.shuffle) player.toggleShuffle();
  }

  const comment = () => playlist()?.comment?.trim();

  return (
    <Page>
      <Show
        when={!data.loading || data.latest}
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
            <Show
              when={editable()}
              fallback={
                <Cover
                  coverArtId={playlist()!.coverArt ?? playlist()!.id}
                  cacheKey={playlists.coverKey(playlist()!.id)}
                  size={400}
                  alt={playlist()!.name}
                  class="glass-cover size-44 shrink-0 rounded-xl shadow-lg"
                  iconClass="size-10"
                  zoomable
                />
              }
            >
              <button
                type="button"
                class="glass-cover group relative size-44 shrink-0 overflow-hidden rounded-xl shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => playlists.openEdit(playlist()!)}
                aria-label={t("playlist.edit")}
              >
                <Cover
                  coverArtId={playlist()!.coverArt ?? playlist()!.id}
                  cacheKey={playlists.coverKey(playlist()!.id)}
                  size={400}
                  alt={playlist()!.name}
                  class="size-full"
                  iconClass="size-10"
                />
                <span class="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Pencil class="size-5" />
                  {t("playlist.edit")}
                </span>
              </button>
            </Show>
            <div class="flex min-w-0 flex-1 flex-col justify-end gap-3">
              <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <ListMusic class="size-3.5" />
                {t("nav.playlists")}
                <Show when={playlist()!.public !== undefined}>
                  <span class="px-0.5">•</span>
                  <Show
                    when={playlist()!.public}
                    fallback={
                      <span class="flex items-center gap-1">
                        <Lock class="size-3" />
                        {t("playlist.private")}
                      </span>
                    }
                  >
                    <span class="flex items-center gap-1">
                      <Globe class="size-3" />
                      {t("playlist.public")}
                    </span>
                  </Show>
                </Show>
              </p>
              <h1 class="text-2xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
                {playlist()!.name}
              </h1>
              <Show when={comment()}>
                <p class="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                  {comment()}
                </p>
              </Show>
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    as={Button}
                    variant="ghost"
                    size="icon"
                    aria-label={t("action.more")}
                    title={t("action.more")}
                  >
                    <Ellipsis class="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <Show when={editable()}>
                      <DropdownMenuItem
                        onSelect={() => playlists.openEdit(playlist()!)}
                      >
                        <Pencil class="size-4" />
                        {t("playlist.edit")}
                      </DropdownMenuItem>
                    </Show>
                    <DropdownMenuItem
                      disabled={!songs().length}
                      onSelect={() => player.addToQueue(songs())}
                    >
                      <ListPlus class="size-4" />
                      {t("action.addToQueue")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!songs().length}
                      onSelect={() => playlists.openAddTo(songs())}
                    >
                      <ListMusic class="size-4" />
                      {t("playlist.addTo.action")}
                    </DropdownMenuItem>
                    <Show when={editable()}>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={() => playlists.openDelete(playlist()!)}
                      >
                        <Trash2 class="size-4" />
                        {t("playlist.delete.action")}
                      </DropdownMenuItem>
                    </Show>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div class="mt-8">
            <Show
              when={songs().length > 0}
              fallback={
                <EmptyState
                  icon={<ListMusic class="size-5" />}
                  title={t("playlist.emptyTitle")}
                  description={editable() ? t("playlist.emptyHint") : undefined}
                />
              }
            >
              <TrackList
                songs={songs()}
                sourceName={playlist()!.name}
                showAlbum
                showCover
                onMove={editable() ? moveSong : undefined}
                onRemove={editable() ? removeSong : undefined}
              />
            </Show>
          </div>
        </Show>
      </Show>
    </Page>
  );
}
