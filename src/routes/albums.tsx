import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { Disc3 } from "lucide-solid";
import { Button } from "~/components/ui/button";
import type { Album, AlbumListType } from "~/lib/types";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { AlbumGrid } from "~/components/album-card";
import { EmptyState, ErrorState } from "~/components/common";
import { Select, Skeleton } from "~/components/ui/select";

const PAGE_SIZE = 60;
const sortOptions: Array<{ value: AlbumListType; key: MessageKey }> = [
  { value: "newest", key: "albums.sort.newest" },
  { value: "recent", key: "albums.sort.recent" },
  { value: "alphabeticalByName", key: "albums.sort.alphabeticalByName" },
  { value: "alphabeticalByArtist", key: "albums.sort.alphabeticalByArtist" },
  { value: "frequent", key: "albums.sort.frequent" },
  { value: "starred", key: "albums.sort.starred" },
  { value: "random", key: "albums.sort.random" },
];

export default function AlbumsPage() {
  const servers = useServers();
  const [albums, setAlbums] = createSignal<Album[]>([]);
  const [type, setType] = createSignal<AlbumListType>("newest");
  const [offset, setOffset] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(true);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<unknown>(null);

  let requestId = 0;
  onCleanup(() => { requestId += 1; });

  async function load(startOffset = 0) {
    const client = servers.client();
    if (!client) return;
    const id = (requestId += 1);
    setLoading(true);
    setError(null);
    try {
      const page = await client.getAlbumList2(type(), PAGE_SIZE, startOffset);
      if (id !== requestId) return;
      setAlbums(page);
      setOffset(startOffset);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      if (id === requestId) setError(err);
    } finally {
      if (id === requestId) {
        setLoading(false);
      }
    }
  }

  createEffect(
    on([servers.client, type], () => {
      void load(0);
    }),
  );

  return (
    <Page>
      <PageHeader
        title={t("albums.title")}
        actions={
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            {t("albums.sort")}
            <Select
              aria-label={t("albums.sort")}
              class="w-44"
              value={type()}
              options={sortOptions.map((option) => ({
                value: option.value,
                label: t(option.key),
              }))}
              onChange={(value) => setType(value as AlbumListType)}
            />
          </label>
        }
      />

      <Show
        when={!error()}
        fallback={
          <ErrorState
            message={t(subsonicErrorKey(error()) as MessageKey)}
            onRetry={() => void load(0)}
            retryLabel={t("action.retry")}
          />
        }
      >
        <Show
          when={albums().length > 0}
          fallback={
            <Show
              when={!loading()}
              fallback={
                <div class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4">
                  {Array.from({ length: 12 }).map(() => (
                    <div class="space-y-2">
                      <Skeleton class="aspect-square w-full rounded-lg" />
                      <Skeleton class="h-3 w-3/4" />
                      <Skeleton class="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              }
            >
              <EmptyState
                icon={<Disc3 class="size-5" />}
                title={t("albums.empty")}
              />
            </Show>
          }
        >
          <AlbumGrid albums={albums()} />
        </Show>

          <nav class="mt-6 flex items-center justify-center gap-4" aria-label={t("albums.title")}>
            <Button variant="outline" disabled={loading() || offset() === 0}
              onClick={() => void load(Math.max(0, offset() - PAGE_SIZE))}>
              {t("action.previous")}
            </Button>
            <span class="text-sm tabular-nums" aria-live="polite">{Math.floor(offset() / PAGE_SIZE) + 1}</span>
            <Button variant="outline" disabled={loading() || !hasMore()}
              onClick={() => void load(offset() + PAGE_SIZE)}>
              {t("action.next")}
            </Button>
          </nav>
      </Show>
    </Page>
  );
}
