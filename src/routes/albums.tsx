import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { Disc3, LoaderCircle } from "lucide-solid";
import type { Album, AlbumListType } from "~/lib/types";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { AlbumGrid } from "~/components/album-card";
import { EmptyState, ErrorState } from "~/components/common";
import { Select, Skeleton } from "~/components/ui/select";

const PAGE_SIZE = 60;
const LOAD_MORE_MARGIN = 600;

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
  let loadMoreSentinel: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;

  function canLoadMore() {
    return hasMore() && !loading() && !error();
  }

  function loadMoreIfNeeded() {
    if (!canLoadMore()) return;
    if (!loadMoreSentinel) return;
    const distanceToBottom = loadMoreSentinel.getBoundingClientRect().top;
    if (distanceToBottom > window.innerHeight + LOAD_MORE_MARGIN) return;
    void load(false);
  }

  function observeSentinel(el: HTMLDivElement) {
    loadMoreSentinel = el;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreIfNeeded();
      },
      { rootMargin: `0px 0px ${LOAD_MORE_MARGIN}px 0px` },
    );
    observer.observe(el);
  }

  onCleanup(() => observer?.disconnect());

  async function load(reset: boolean) {
    const client = servers.client();
    if (!client) return;
    if (!reset && (!hasMore() || loading())) return;
    const id = (requestId += 1);
    const startOffset = reset ? 0 : offset();
    setLoading(true);
    setError(null);
    if (reset) {
      setAlbums([]);
      setOffset(0);
    }
    try {
      const page = await client.getAlbumList2(type(), PAGE_SIZE, startOffset);
      if (id !== requestId) return;
      setAlbums((previous) => (reset ? page : [...previous, ...page]));
      setOffset(startOffset + page.length);
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      if (id === requestId) setError(err);
    } finally {
      if (id === requestId) {
        setLoading(false);
        // Content may still not fill the viewport, so keep loading page after page.
        if (!reset) loadMoreIfNeeded();
      }
    }
  }

  createEffect(
    on([servers.client, type], () => {
      void load(true);
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
            onRetry={() => void load(true)}
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

          <div
            ref={observeSentinel}
            aria-hidden="true"
            class="mt-6 flex h-10 items-center justify-center"
          >
            <Show when={loading()}>
              <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
            </Show>
          </div>
        </Show>
      </Show>
    </Page>
  );
}
