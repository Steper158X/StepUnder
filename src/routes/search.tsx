import { Show, createEffect, createResource, createSignal, on, onCleanup } from "solid-js";
import { Search } from "lucide-solid";
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

type Tab = "all" | "songs" | "albums" | "artists";

const tabs: Array<{ value: Tab; key: MessageKey }> = [
  { value: "all", key: "search.all" },
  { value: "songs", key: "search.songs" },
  { value: "albums", key: "search.albums" },
  { value: "artists", key: "search.artists" },
];

export default function SearchPage() {
  const servers = useServers();
  const [input, setInput] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [tab, setTab] = createSignal<Tab>("all");

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

  const showSongs = () => tab() === "all" || tab() === "songs";
  const showAlbums = () => tab() === "all" || tab() === "albums";
  const showArtists = () => tab() === "all" || tab() === "artists";

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
              <div class="space-y-8">
                <Show when={showSongs() && results()!.songs.length > 0}>
                  <section class="space-y-2">
                    <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("search.songs")}
                    </h2>
                    <TrackList
                      songs={results()!.songs}
                      sourceName={t("search.songs")}
                      showAlbum
                    />
                  </section>
                </Show>

                <Show when={showAlbums() && results()!.albums.length > 0}>
                  <section class="space-y-3">
                    <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("search.albums")}
                    </h2>
                    <AlbumGrid albums={results()!.albums} />
                  </section>
                </Show>

                <Show when={showArtists() && results()!.artists.length > 0}>
                  <section class="space-y-3">
                    <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("search.artists")}
                    </h2>
                    <div class="flex flex-wrap gap-x-6 gap-y-7">
                      {results()!.artists.map((artist) => (
                        <ArtistTile artist={artist} />
                      ))}
                    </div>
                  </section>
                </Show>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
