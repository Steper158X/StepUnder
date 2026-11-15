import { A, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createResource } from "solid-js";
import {
  ChevronLeft,
  Disc3,
  Headphones,
  ListMusic,
  Play,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
} from "lucide-solid";
import type {
  Album,
  Playlist,
  ServerInfo,
  Song,
  StarredResult,
} from "~/lib/types";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, locale, type MessageKey } from "~/i18n";
import { subsonicErrorKey, type SubsonicClient } from "~/lib/subsonic";
import { formatDate, initials } from "~/lib/format";
import { isNarrow } from "~/lib/platform";
import { Page, PageHeader } from "~/components/layout-bits";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/select";
import {
  ArtistAvatar,
  Cover,
  EmptyState,
  ErrorState,
  Spinner,
} from "~/components/common";
import { TrackList } from "~/components/track-row";

interface ProfileData {
  frequent: Album[];
  recent: Album[];
  starred: StarredResult;
  playlists: Playlist[];
  info: ServerInfo;
  topSongs: Song[];
}

const EMPTY_STARRED: StarredResult = { artists: [], albums: [], songs: [] };

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

const TOP_SONG_COUNT = 8;
const ALBUM_BATCH = 6;
const MAX_ALBUMS_SCANNED = 36;

type Client = SubsonicClient;

const byPlays = (a: Song, b: Song) =>
  (b.playCount ?? 0) - (a.playCount ?? 0) ||
  (b.played ?? "").localeCompare(a.played ?? "");

/**
 * The user's own most played songs. Subsonic has no "most played songs"
 * endpoint, and `getTopSongs` ranks by global (Last.fm) popularity rather than
 * the user's plays, so read the tracks of the most played albums instead.
 * An album's play count is at least the play count of any song on it, so once
 * the next album has fewer plays than the current #8 song, no later album can
 * change the chart and scanning stops.
 */
async function loadTopSongs(client: Client, frequent: Album[]): Promise<Song[]> {
  const albums = [...frequent]
    .filter((album) => album?.id)
    .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
  const hasCounts = albums.some((album) => typeof album.playCount === "number");

  if (!hasCounts) {
    // No play counts on this server: fall back to per-artist top songs.
    const artistNames = [
      ...new Set(
        albums
          .map((album) => album.artist)
          .filter((name): name is string => Boolean(name)),
      ),
    ].slice(0, 3);
    const results = await Promise.all(
      artistNames.map((name) => safe(client.getTopSongs(name, 10), [])),
    );
    const merged = new Map<string, Song>();
    for (const song of results.flat()) merged.set(song.id, song);
    return [...merged.values()].slice(0, TOP_SONG_COUNT);
  }

  const merged = new Map<string, Song>();
  const ranked = () => [...merged.values()].sort(byPlays);
  const limit = Math.min(albums.length, MAX_ALBUMS_SCANNED);

  for (let i = 0; i < limit; i += ALBUM_BATCH) {
    const current = ranked();
    const cutoff =
      current.length >= TOP_SONG_COUNT
        ? (current[TOP_SONG_COUNT - 1].playCount ?? 0)
        : 0;
    const batch = albums
      .slice(i, Math.min(i + ALBUM_BATCH, limit))
      .filter((album) => (album.playCount ?? 0) > cutoff);
    if (batch.length === 0) break;

    const results = await Promise.all(
      batch.map((album) =>
        safe(client.getAlbum(album.id), { album, songs: [] as Song[] }),
      ),
    );
    for (const { songs } of results) {
      for (const song of songs) {
        if ((song.playCount ?? 0) > 0) merged.set(song.id, song);
      }
    }
  }

  return ranked().slice(0, TOP_SONG_COUNT);
}

function Stat(props: {
  icon: import("solid-js").JSX.Element;
  label: string;
  value: string;
}) {
  return (
    <div class="flex items-center gap-2.5 bg-card p-3 sm:gap-3 sm:p-4">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground sm:size-9">
        {props.icon}
      </span>
      <div class="min-w-0">
        <p class="truncate text-lg font-semibold leading-tight tabular-nums">
          {props.value}
        </p>
        <p class="truncate text-[11px] text-muted-foreground">{props.label}</p>
      </div>
    </div>
  );
}

function SectionTitle(props: {
  icon: import("solid-js").JSX.Element;
  title: string;
  hint?: string;
  children?: import("solid-js").JSX.Element;
}) {
  return (
    <div class="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        {props.icon}
        {props.title}
      </h2>
      <Show when={props.hint}>
        <span class="text-[11px] text-muted-foreground">{props.hint}</span>
      </Show>
      {props.children}
    </div>
  );
}

function EmptyHint(props: { text: string }) {
  return (
    <p class="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
      {props.text}
    </p>
  );
}

export default function ProfilePage() {
  const servers = useServers();
  const player = usePlayer();
  const navigate = useNavigate();

  const [data, { refetch }] = createResource(
    () => servers.client(),
    async (client): Promise<ProfileData> => {
      const [frequent, recent, starred, playlists, info] = await Promise.all([
        safe(client.getAlbumList2("frequent", 500), []),
        safe(client.getAlbumList2("recent", 24), []),
        safe(client.getStarred2(), EMPTY_STARRED),
        safe(client.getPlaylists(), []),
        safe(client.getServerInfo(), {}),
      ]);

      const topSongs = await loadTopSongs(client, frequent);

      return {
        frequent,
        recent,
        starred,
        playlists,
        info,
        topSongs,
      };
    },
  );

  const totalPlays = createMemo(() =>
    (data()?.frequent ?? []).reduce(
      (total, album) => total + (album.playCount ?? 0),
      0,
    ),
  );

  const hasPlayCounts = createMemo(() =>
    (data()?.frequent ?? []).some(
      (album) => typeof album.playCount === "number",
    ),
  );

  /**
   * Only albums the user actually listened to. Navidrome's "frequent" list is
   * already play-count ordered, "recent" adds the latest plays; dedupe by id so
   * an album that appears in both lists is counted once.
   */
  const playedAlbums = createMemo(() => {
    const value = data();
    if (!value) return [] as Album[];
    // Servers without play counts still return their most-played albums from
    // "frequent", so there is nothing to filter in that case.
    const requirePlay = hasPlayCounts();
    const merged = new Map<string, Album>();
    for (const album of [...value.frequent, ...value.recent]) {
      if (!album?.id) continue;
      if (
        requirePlay &&
        !((album.playCount ?? 0) > 0) &&
        !album.played
      ) {
        continue;
      }
      merged.set(album.id, album);
    }
    return [...merged.values()];
  });

  const albumCount = createMemo(() => playedAlbums().length);

  const artistCount = createMemo(() => {
    const keys = new Set<string>();
    for (const album of playedAlbums()) {
      keys.add(album.artistId ?? album.artist ?? album.id);
    }
    return keys.size;
  });

  const playlistCount = createMemo(() => {
    const list = data()?.playlists ?? [];
    const username = servers.activeServer()?.username?.trim().toLowerCase();
    if (!username) return list.length;
    return list.filter(
      (playlist) =>
        !playlist.owner ||
        playlist.owner.trim().toLowerCase() === username,
    ).length;
  });

  const favoriteCount = createMemo(() => {
    const starred = data()?.starred;
    if (!starred) return 0;
    return starred.albums.length + starred.songs.length + starred.artists.length;
  });

  const topAlbums = createMemo(() =>
    [...(data()?.frequent ?? [])]
      .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
      .slice(0, 6),
  );

  const topArtists = createMemo(() => {
    const grouped = new Map<
      string,
      { id?: string; name: string; plays: number; albums: number }
    >();
    for (const album of data()?.frequent ?? []) {
      const name = album.artist ?? t("common.unknownArtist");
      const key = album.artistId ?? name;
      const entry = grouped.get(key) ?? {
        id: album.artistId,
        name,
        plays: 0,
        albums: 0,
      };
      entry.plays += album.playCount ?? 0;
      entry.albums += 1;
      grouped.set(key, entry);
    }
    return [...grouped.values()]
      .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))
      .slice(0, 5);
  });

  const recent = createMemo(() => (data()?.recent ?? []).slice(0, 5));

  const favoriteSongs = createMemo(() =>
    (data()?.starred.songs ?? []).slice(0, 8),
  );

  const topSongs = createMemo(() => data()?.topSongs ?? []);

  const serverLabel = createMemo(() => {
    const info = data()?.info;
    const type = info?.type
      ? info.type.charAt(0).toUpperCase() + info.type.slice(1)
      : null;
    const version = info?.serverVersion ?? info?.version;
    if (type && version) return `${type} ${version}`;
    return type ?? (version ? `Subsonic ${version}` : null);
  });

  return (
    <Page class="max-w-5xl">
      <Show when={isNarrow()}>
        <A
          href="/settings"
          class="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft class="size-4" />
          {t("settings.title")}
        </A>
      </Show>
      <PageHeader
        title={t("profile.title")}
        subtitle={isNarrow() ? undefined : t("profile.subtitle")}
        class={isNarrow() ? "flex-nowrap items-center" : undefined}
        actions={
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size={isNarrow() ? "icon" : "sm"}
              onClick={() => void refetch()}
              disabled={data.loading}
              aria-label={t("action.refresh")}
              title={t("action.refresh")}
            >
              <RefreshCw
                class={`size-3.5 ${data.loading ? "animate-spin" : ""}`}
              />
              <Show when={!isNarrow()}>{t("action.refresh")}</Show>
            </Button>
            <Button
              variant="outline"
              size={isNarrow() ? "icon" : "sm"}
              onClick={() => navigate("/servers")}
              aria-label={t("profile.manageServers")}
              title={t("profile.manageServers")}
            >
              <Settings class="size-3.5" />
              <Show when={!isNarrow()}>{t("profile.manageServers")}</Show>
            </Button>
          </div>
        }
      />

      <Show
        when={!data.loading}
        fallback={
          <div class="flex justify-center py-20">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!data.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(data.error) as MessageKey)}
              onRetry={() => void refetch()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Card class="mb-6 overflow-hidden">
            <div class="flex flex-wrap items-center gap-3 bg-gradient-to-br from-primary/15 via-card to-card p-4 sm:gap-4 sm:p-5">
              <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-sm sm:size-16 sm:text-xl">
                {initials(servers.activeServer()?.username)}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("profile.signedInAs")}
                </p>
                <h2 class="truncate text-lg font-semibold sm:text-xl">
                  {servers.activeServer()?.username ?? "—"}
                </h2>
                <p class="truncate text-sm text-muted-foreground">
                  {servers.activeServer()?.name}
                  <Show when={!isNarrow() && servers.activeServer()?.url}>
                    {" · "}
                    {servers.activeServer()?.url}
                  </Show>
                </p>
              </div>
              <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Show when={serverLabel()}>
                  <Badge variant="outline">{serverLabel()}</Badge>
                </Show>
                <Badge>{t("servers.active")}</Badge>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 sm:grid-cols-4">
              <Stat
                icon={<Headphones class="size-4" />}
                label={t("profile.totalPlays")}
                value={
                  hasPlayCounts()
                    ? totalPlays().toLocaleString()
                    : "—"
                }
              />
              <Stat
                icon={<Users class="size-4" />}
                label={t("profile.artists")}
                value={String(artistCount())}
              />
              <Stat
                icon={<Disc3 class="size-4" />}
                label={t("profile.albums")}
                value={String(albumCount())}
              />
              <Stat
                icon={<ListMusic class="size-4" />}
                label={t("profile.playlists")}
                value={String(playlistCount())}
              />
            </div>
          </Card>

          <section class="mb-7">
            <SectionTitle
              icon={<TrendingUp class="size-4 text-muted-foreground" />}
              title={t("profile.topAlbums")}
              hint={
                hasPlayCounts()
                  ? t("profile.topAlbumsHint")
                  : t("profile.noPlayCounts")
              }
            />
            <Show
              when={topAlbums().length > 0}
              fallback={<EmptyHint text={t("profile.emptyHistory")} />}
            >
              <Show when={isNarrow()}>
                <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  <For each={topAlbums()}>
                    {(album, index) => (
                      <A
                        href={`/album/${album.id}`}
                        class="w-32 shrink-0 snap-start"
                      >
                        <div class="relative">
                          <Cover
                            coverArtId={album.coverArt ?? album.id}
                            size={256}
                            alt={album.name}
                            class="aspect-square w-full rounded-lg"
                          />
                          <span class="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-[11px] font-semibold tabular-nums text-white">
                            {index() + 1}
                          </span>
                        </div>
                        <p class="mt-1.5 truncate text-sm font-medium">
                          {album.name}
                        </p>
                        <p class="truncate text-[11px] text-muted-foreground">
                          {album.artist ?? t("common.unknownArtist")}
                          <Show when={album.playCount}>
                            {(plays) => (
                              <>
                                {" · "}
                                {t("profile.plays", { count: plays() })}
                              </>
                            )}
                          </Show>
                        </p>
                      </A>
                    )}
                  </For>
                </div>
              </Show>
              <div class="hidden gap-2 md:grid md:grid-cols-2">
                <For each={topAlbums()}>
                  {(album, index) => (
                    <A
                      href={`/album/${album.id}`}
                      class="group flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2 transition-colors hover:bg-accent/50"
                    >
                      <span class="w-4 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                        {index() + 1}
                      </span>
                      <Cover
                        coverArtId={album.coverArt ?? album.id}
                        size={96}
                        alt={album.name}
                        class="size-11 rounded-md"
                      />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium group-hover:text-primary">
                          {album.name}
                        </p>
                        <p class="truncate text-xs text-muted-foreground">
                          {album.artist ?? t("common.unknownArtist")}
                        </p>
                      </div>
                      <Show when={album.playCount}>
                        {(plays) => (
                          <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {t("profile.plays", { count: plays() })}
                          </span>
                        )}
                      </Show>
                    </A>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <div class="mb-7 grid gap-6 lg:grid-cols-2">
            <section>
              <SectionTitle
                icon={<Users class="size-4 text-muted-foreground" />}
                title={t("profile.topArtists")}
              />
              <Show
                when={topArtists().length > 0}
                fallback={<EmptyHint text={t("profile.emptyHistory")} />}
              >
                <div class="space-y-1">
                  <For each={topArtists()}>
                    {(artist, index) => (
                      <A
                        href={
                          artist.id ? `/artist/${artist.id}` : "/artists"
                        }
                        class="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
                      >
                        <span class="w-4 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                          {index() + 1}
                        </span>
                        <ArtistAvatar
                          id={artist.id}
                          name={artist.name}
                          size={72}
                          class="size-9 text-[11px]"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium group-hover:text-primary">
                            {artist.name}
                          </p>
                          <p class="truncate text-[11px] text-muted-foreground">
                            {t("profile.albumCount", {
                              count: artist.albums,
                            })}
                          </p>
                        </div>
                        <Show when={artist.plays > 0}>
                          <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {t("profile.plays", { count: artist.plays })}
                          </span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
              </Show>
            </section>

            <section>
              <SectionTitle
                icon={<Headphones class="size-4 text-muted-foreground" />}
                title={t("profile.recentlyPlayed")}
              />
              <Show
                when={recent().length > 0}
                fallback={<EmptyHint text={t("profile.emptyHistory")} />}
              >
                <div class="space-y-1">
                  <For each={recent()}>
                    {(album) => (
                      <A
                        href={`/album/${album.id}`}
                        class="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
                      >
                        <Cover
                          coverArtId={album.coverArt ?? album.id}
                          size={96}
                          alt={album.name}
                          class="size-9 rounded"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium group-hover:text-primary">
                            {album.name}
                          </p>
                          <p class="truncate text-[11px] text-muted-foreground">
                            {album.artist ?? t("common.unknownArtist")}
                          </p>
                        </div>
                        <Show when={album.played}>
                          <span class="shrink-0 text-[11px] text-muted-foreground">
                            {formatDate(album.played, locale())}
                          </span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
              </Show>
            </section>
          </div>

          <section class="mb-7">
            <SectionTitle
              icon={<TrendingUp class="size-4 text-muted-foreground" />}
              title={t("profile.topSongs")}
              hint={hasPlayCounts() ? undefined : t("profile.noPlayCounts")}
            />
            <Show
              when={topSongs().length > 0}
              fallback={<EmptyHint text={t("profile.emptyHistory")} />}
            >
              <div class="space-y-1">
                <For each={topSongs()}>
                  {(song) => (
                    <button
                      type="button"
                      onClick={() =>
                        player.playSong(
                          song,
                          topSongs(),
                          t("profile.topSongs"),
                        )
                      }
                      class="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
                    >
                      <Cover
                        coverArtId={song.coverArt ?? song.albumId}
                        size={96}
                        alt={song.album ?? song.title}
                        class="size-9 rounded"
                      />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium group-hover:text-primary">
                          {song.title}
                        </p>
                        <p class="truncate text-[11px] text-muted-foreground">
                          {song.artist ?? t("common.unknownArtist")}
                          <Show when={song.album}>
                            {" • "}
                            {song.album}
                          </Show>
                        </p>
                      </div>
                      <Show when={song.playCount}>
                        {(plays) => (
                          <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {t("profile.plays", { count: plays() })}
                          </span>
                        )}
                      </Show>
                      <Play class="hidden size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" />
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section>
            <SectionTitle
              icon={<TrendingUp class="size-4 text-muted-foreground" />}
              title={t("profile.favoriteSongs")}
            >
              <Badge variant="secondary">{favoriteCount()}</Badge>
            </SectionTitle>
            <Show
              when={favoriteSongs().length > 0}
              fallback={
                <EmptyState
                  icon={<ListMusic class="size-5" />}
                  title={t("profile.emptyFavorites")}
                  description={t("profile.emptyFavoritesHint")}
                  class="border-none"
                />
              }
            >
              <TrackList songs={favoriteSongs()} showAlbum showCover />
            </Show>
          </section>
        </Show>
      </Show>
    </Page>
  );
}
