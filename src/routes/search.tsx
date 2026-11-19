import {
  Show,
  type JSX,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { ChevronRight, Search } from "lucide-solid";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { AlbumGrid } from "~/components/album-card";
import { TrackList } from "~/components/track-row";
import { ArtistTile } from "~/routes/artists";
import { EmptyState, ErrorState, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { takeKeyboardFocus } from "~/lib/keyboard";

type Tab = "all" | "songs" | "albums" | "artists";

const tabs: Array<{ value: Tab; key: MessageKey }> = [
  { value: "all", key: "search.all" },
  { value: "songs", key: "search.songs" },
  { value: "albums", key: "search.albums" },
  { value: "artists", key: "search.artists" },
];

/** How many items each section shows on the "All" tab before "See all". */
const PREVIEW = { songs: 8, albums: 8, artists: 8 };

export default function SearchPage() {
  const servers = useServers();
  const [input, setInput] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [tab, setTab] = createSignal<Tab>("all");
  let searchInput: HTMLInputElement | undefined;

  // `autofocus` is ignored on elements added after page load, so focus the box
  // here. The bottom tab already focused a stand-in during the tap, which is
  // what makes the phone keyboard open.
  onMount(() => takeKeyboardFocus(searchInput));

  createEffect(
    on(input, (value) => {
      const timer = setTimeout(() => setQuery(value.trim()), 300);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  const [results, { refetch: reloadSearch }] = createResource(
    () => {
      const client = servers.client();
      const term = query();
      return client && term ? { client, term } : undefined;
    },
    ({ client, term }) => client.search3(term),
  );

  const songs = () => results()?.songs ?? [];
  const albums = () => results()?.albums ?? [];
  const artists = () => results()?.artists ?? [];

  const hasResults = () => {
    const value = results();
    if (!value) return false;
    return value.songs.length + value.albums.length + value.artists.length > 0;
  };

  return (
    <Page>
      <PageHeader title={t("search.title")} />

      <div class="relative mb-5 max-w-md">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInput}
          value={input()}
          onInput={(event) => setInput(event.currentTarget.value)}
          placeholder={t("search.placeholder")}
          class="h-10 pl-9"
          autofocus
          spellcheck={false}
          autocomplete="off"
        />
      </div>

      <div class="mb-5 flex flex-wrap gap-1.5">
        {tabs.map((item) => (
          <Button
            variant={tab() === item.value ? "secondary" : "ghost"}
            size="sm"
            class={cn(tab() !== item.value && "text-muted-foreground")}
            onClick={() => setTab(item.value)}
          >
            {t(item.key)}
          </Button>
        ))}
      </div>

      <Show
        when={query()}
        fallback={
          <EmptyState
            icon={<Search class="size-5" />}
            title={t("search.empty")}
            description={t("search.hint")}
          />
        }
      >
        <Show
          when={!results.loading}
          fallback={
            <div class="flex justify-center py-14">
              <Spinner />
            </div>
          }
        >
          <Show
            when={!results.error}
            fallback={
              <ErrorState
                message={t(subsonicErrorKey(results.error) as MessageKey)}
                onRetry={() => reloadSearch()}
                retryLabel={t("action.retry")}
              />
            }
          >
            <Show
              when={hasResults()}
              fallback={
                <EmptyState
                  icon={<Search class="size-5" />}
                  title={t("search.noResults", { query: query() })}
                />
              }
            >
              <Show
                when={tab() === "all"}
                fallback={
                  <div class="space-y-8">
                    <Show when={tab() === "songs" && songs().length > 0}>
                      <ResultSection title={t("search.songs")} count={songs().length}>
                        <TrackList
                          songs={songs()}
                          sourceName={t("search.songs")}
                          showAlbum
                          showCover
                        />
                      </ResultSection>
                    </Show>
                    <Show when={tab() === "albums" && albums().length > 0}>
                      <ResultSection title={t("search.albums")} count={albums().length}>
                        <AlbumGrid albums={albums()} />
                      </ResultSection>
                    </Show>
                    <Show when={tab() === "artists" && artists().length > 0}>
                      <ResultSection title={t("search.artists")} count={artists().length}>
                        <ArtistRow artists={artists()} />
                      </ResultSection>
                    </Show>
                  </div>
                }
              >
                <div class="space-y-10">
                  {/* Songs on the left, albums on the right; stacked on narrow screens. */}
                  <Show when={songs().length > 0 || albums().length > 0}>
                    <div
                      class={cn(
                        "grid gap-8",
                        songs().length > 0 &&
                          albums().length > 0 &&
                          "lg:grid-cols-2 lg:gap-10",
                      )}
                    >
                      <Show when={songs().length > 0}>
                        <ResultSection
                          title={t("search.songs")}
                          count={songs().length}
                          onMore={() => setTab("songs")}
                          class="min-w-0"
                        >
                          <TrackList
                            songs={songs().slice(0, PREVIEW.songs)}
                            sourceName={t("search.songs")}
                            showAlbum
                            showCover
                          />
                        </ResultSection>
                      </Show>
                      <Show when={albums().length > 0}>
                        <ResultSection
                          title={t("search.albums")}
                          count={albums().length}
                          onMore={() => setTab("albums")}
                          class="min-w-0"
                        >
                          <AlbumGrid albums={albums().slice(0, PREVIEW.albums)} />
                        </ResultSection>
                      </Show>
                    </div>
                  </Show>

                  <Show when={artists().length > 0}>
                    <ResultSection
                      title={t("search.artists")}
                      count={artists().length}
                      onMore={() => setTab("artists")}
                    >
                      <ArtistRow artists={artists().slice(0, PREVIEW.artists)} />
                    </ResultSection>
                  </Show>
                </div>
              </Show>
            </Show>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}

function ResultSection(props: {
  title: string;
  count: number;
  /** Shown on the "All" tab: jumps to the tab with every result of this kind. */
  onMore?: () => void;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <section class={cn("space-y-3", props.class)}>
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {props.title}
          <span class="ml-1.5 font-normal normal-case tabular-nums">
            ({props.count})
          </span>
        </h2>
        <Show when={props.onMore}>
          <button
            type="button"
            onClick={() => props.onMore!()}
            class="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("home.more")}
            <ChevronRight class="size-3.5" />
          </button>
        </Show>
      </div>
      {props.children}
    </section>
  );
}

function ArtistRow(props: { artists: Parameters<typeof ArtistTile>[0]["artist"][] }) {
  return (
    <div class="flex flex-wrap gap-x-6 gap-y-7">
      {props.artists.map((artist) => (
        <ArtistTile artist={artist} />
      ))}
    </div>
  );
}
