import {
  createEffect,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { ChevronLeft, ChevronRight, Disc3 } from "lucide-solid";
import { Button } from "~/components/ui/button";
import type { Album, AlbumListType } from "~/lib/types";
import { useServers } from "~/state/servers";
import { albumPaging } from "~/state/settings";
import { t, type MessageKey } from "~/i18n";
import { SubsonicClient, subsonicErrorKey } from "~/lib/subsonic";
import { isNarrow } from "~/lib/platform";
import { cn } from "~/lib/utils";
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

/**
 * One page plus whether anything follows it. Asks for one extra album, since a
 * full page alone can't tell "exactly 60 left" from "more after this".
 */
async function fetchPage(
  client: SubsonicClient,
  type: AlbumListType,
  offset: number,
): Promise<{ items: Album[]; more: boolean }> {
  const page = await client.getAlbumList2(type, PAGE_SIZE + 1, offset);
  return { items: page.slice(0, PAGE_SIZE), more: page.length > PAGE_SIZE };
}

/**
 * Album count for a list type. The Subsonic API has no total, so this probes
 * single albums: doubling until an offset comes back empty, then halving the
 * gap. About 2·log2(n) tiny requests. `known` is an offset that exists.
 */
async function countAlbums(
  client: SubsonicClient,
  type: AlbumListType,
  known: number,
): Promise<number> {
  const exists = async (index: number) =>
    (await client.getAlbumList2(type, 1, index)).length > 0;
  let present = known;
  let missing = Math.max(256, known * 2);
  while (await exists(missing)) {
    present = missing;
    missing *= 2;
  }
  while (missing - present > 1) {
    const middle = Math.floor((present + missing) / 2);
    if (await exists(middle)) present = middle;
    else missing = middle;
  }
  return missing;
}

type PageItem = number | "gap-start" | "gap-end";

/**
 * 1 2 3 … 14 15 16: the first and last few pages, plus the current page when
 * it sits between them (1 2 3 … 8 … 14 15 16).
 */
function pageItems(current: number, total: number, edge: number): PageItem[] {
  const sibling = 0;
  // Few enough pages that every one fits in the slots the gaps would take.
  if (total <= edge * 2 + sibling * 2 + 3) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages = new Set<number>();
  for (let page = 1; page <= edge; page += 1) pages.add(page);
  for (let page = total - edge + 1; page <= total; page += 1) pages.add(page);
  for (let page = current - sibling; page <= current + sibling; page += 1) {
    if (page >= 1 && page <= total) pages.add(page);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined) {
      // A gap of one page shows that page instead of "…".
      if (page - previous === 2) items.push(previous + 1);
      else if (page - previous > 2)
        items.push(page < current ? "gap-start" : "gap-end");
    }
    items.push(page);
  });
  return items;
}

export default function AlbumsPage() {
  const servers = useServers();
  const [albums, setAlbums] = createSignal<Album[]>([]);
  const [type, setType] = createSignal<AlbumListType>("newest");
  const [offset, setOffset] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(true);
  const [total, setTotal] = createSignal<number | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<unknown>(null);

  let requestId = 0;
  /** Bumped per list (server, sort or mode change) so stale counts are dropped. */
  let listId = 0;
  let topRef: HTMLDivElement | undefined;
  onCleanup(() => {
    requestId += 1;
    listId += 1;
  });

  const scrollMode = () => albumPaging() === "scroll";
  const currentPage = () => Math.floor(offset() / PAGE_SIZE) + 1;
  const totalPages = () => {
    const count = total();
    return count === null ? null : Math.max(1, Math.ceil(count / PAGE_SIZE));
  };

  function scrollToTop() {
    topRef?.closest("main")?.scrollTo({ top: 0 });
  }

  /** Learns the page count once per list, so the pager can show every number. */
  function startCount(client: SubsonicClient, more: boolean, shown: number) {
    if (type() === "random") return;
    if (!more) {
      setTotal(offset() + shown);
      return;
    }
    if (total() !== null) return;
    const id = listId;
    void countAlbums(client, type(), offset() + PAGE_SIZE)
      .then((count) => {
        if (id === listId) setTotal(count);
      })
      .catch(() => {
        // Without a count the pager falls back to previous / next.
      });
  }

  async function loadPage(page: number) {
    const client = servers.client();
    if (!client) return;
    const id = (requestId += 1);
    const startOffset = (Math.max(1, page) - 1) * PAGE_SIZE;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(client, type(), startOffset);
      if (id !== requestId) return;
      // Past the end (the library shrank, or a stale count): go to the last page.
      if (result.items.length === 0 && startOffset > 0) {
        setTotal(null);
        listId += 1;
        const count = await countAlbums(client, type(), 0).catch(() => 0);
        if (id !== requestId) return;
        setTotal(count);
        void loadPage(Math.max(1, Math.ceil(count / PAGE_SIZE)));
        return;
      }
      setAlbums(result.items);
      setOffset(startOffset);
      setHasMore(result.more);
      startCount(client, result.more, result.items.length);
      scrollToTop();
    } catch (err) {
      if (id === requestId) setError(err);
    } finally {
      if (id === requestId) setLoading(false);
    }
  }

  /** Scroll mode: append the next page to what is already shown. */
  async function loadMore() {
    const client = servers.client();
    // A failed load waits for the retry button instead of looping on the sentinel.
    if (!client || loading() || !hasMore() || error()) return;
    const id = (requestId += 1);
    const startOffset = albums().length === 0 ? 0 : offset() + PAGE_SIZE;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(client, type(), startOffset);
      if (id !== requestId) return;
      const seen = new Set(albums().map((album) => album.id));
      const fresh = result.items.filter((album) => !seen.has(album.id));
      setAlbums([...albums(), ...fresh]);
      setOffset(startOffset);
      // Random lists may repeat; stop once a page brings nothing new.
      setHasMore(result.more && fresh.length > 0);
    } catch (err) {
      if (id === requestId) setError(err);
    } finally {
      if (id === requestId) {
        setLoading(false);
        if (!error()) recheckSentinel();
      }
    }
  }

  function reset() {
    requestId += 1;
    listId += 1;
    setAlbums([]);
    setOffset(0);
    setHasMore(true);
    setTotal(null);
    setLoading(false);
    setError(null);
  }

  function retry() {
    setError(null);
    if (scrollMode()) void loadMore();
    else void loadPage(currentPage());
  }

  createEffect(
    on([servers.client, type, albumPaging], () => {
      reset();
      if (scrollMode()) void loadMore();
      else void loadPage(1);
    }),
  );

  // Infinite scroll: load the next page as the sentinel nears the viewport.
  let sentinel: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;
  /** The observer only fires on changes; re-observing reports the current state. */
  function recheckSentinel() {
    if (!observer || !sentinel) return;
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  }
  function attachSentinel(element: HTMLDivElement) {
    sentinel = element;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
  }
  onCleanup(() => observer?.disconnect());

  const pageButtonClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors disabled:pointer-events-none";

  return (
    <Page>
      <div ref={topRef} />
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
        when={!error() || (scrollMode() && albums().length > 0)}
        fallback={
          <ErrorState
            message={t(subsonicErrorKey(error()) as MessageKey)}
            onRetry={retry}
            retryLabel={t("action.retry")}
          />
        }
      >
        <Show
          when={albums().length > 0}
          fallback={
            <Show
              when={!loading() && !hasMore()}
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
          <div
            class={cn(
              "transition-opacity",
              !scrollMode() && loading() && "opacity-60",
            )}
          >
            <AlbumGrid albums={albums()} />
          </div>

          <Show
            when={scrollMode()}
            fallback={
              <Show when={currentPage() > 1 || hasMore()}>
                <nav
                  class="mt-6 flex flex-wrap items-center justify-center gap-1"
                  aria-label={t("albums.pagination")}
                >
                  <Button
                    variant="ghost"
                    class="px-2.5"
                    disabled={loading() || currentPage() === 1}
                    onClick={() => void loadPage(currentPage() - 1)}
                  >
                    <ChevronLeft />
                    <span class="max-sm:sr-only">{t("action.previous")}</span>
                  </Button>

                  <Show
                    when={totalPages()}
                    fallback={
                      <span
                        class={cn(pageButtonClass, "bg-primary text-primary-foreground")}
                        aria-current="page"
                      >
                        {currentPage()}
                      </span>
                    }
                  >
                    {(pages) => (
                      <For
                        each={pageItems(
                          currentPage(),
                          pages(),
                          isNarrow() ? 1 : 3,
                        )}
                      >
                        {(item) =>
                          typeof item === "number" ? (
                            <button
                              type="button"
                              aria-label={t("albums.goToPage", { page: item })}
                              aria-current={
                                item === currentPage() ? "page" : undefined
                              }
                              disabled={loading()}
                              onClick={() => {
                                if (item !== currentPage()) void loadPage(item);
                              }}
                              class={cn(
                                pageButtonClass,
                                item === currentPage()
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                              )}
                            >
                              {item}
                            </button>
                          ) : (
                            <span
                              class="inline-flex h-9 w-6 items-center justify-center text-sm text-muted-foreground"
                              aria-hidden="true"
                            >
                              …
                            </span>
                          )
                        }
                      </For>
                    )}
                  </Show>

                  <Button
                    variant="ghost"
                    class="px-2.5"
                    disabled={loading() || !hasMore()}
                    onClick={() => void loadPage(currentPage() + 1)}
                  >
                    <span class="max-sm:sr-only">{t("action.next")}</span>
                    <ChevronRight />
                  </Button>
                </nav>
              </Show>
            }
          >
            <Show when={hasMore()}>
              <div ref={attachSentinel} class="h-px" aria-hidden="true" />
            </Show>
            <Show when={loading()}>
              <div class="mt-6 flex justify-center">
                <Disc3 class="size-5 animate-spin text-muted-foreground" />
              </div>
            </Show>
            <Show when={error()}>
              <div class="mt-6 flex justify-center">
                <Button variant="outline" onClick={retry}>
                  {t("action.retry")}
                </Button>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
