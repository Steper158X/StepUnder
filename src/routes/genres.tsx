import { A } from "@solidjs/router";
import { createMemo, createResource, createSignal, Show } from "solid-js";
import { Search, Tags } from "lucide-solid";
import type { Genre } from "~/lib/types";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { Page, PageHeader } from "~/components/layout-bits";
import { EmptyState, ErrorState, Spinner } from "~/components/common";
import { Input } from "~/components/ui/input";

/** Stable hue per genre name so each tile keeps its colour between visits. */
function genreHue(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

export function genreHref(name: string) {
  return `/genre/${encodeURIComponent(name)}`;
}

function GenreTile(props: { genre: Genre }) {
  const hue = () => genreHue(props.genre.value);
  return (
    <A
      href={genreHref(props.genre.value)}
      class="glass-tile group block rounded-lg p-2 transition-colors hover:bg-accent/50"
    >
      <div
        class="glass-cover relative flex aspect-square w-full items-end overflow-hidden rounded-xl p-[12%] shadow-sm transition-[filter] group-hover:brightness-110"
        style={{
          background: `linear-gradient(135deg, hsl(${hue()} 68% 46%), hsl(${(hue() + 30) % 360} 62% 38%))`,
        }}
      >
        <p class="relative z-[2] line-clamp-2 break-words text-xl font-bold leading-tight text-white drop-shadow-sm">
          {props.genre.value}
        </p>
      </div>
      <p class="mt-2 truncate text-sm font-medium" title={props.genre.value}>
        {props.genre.value}
      </p>
      <p class="truncate text-xs text-muted-foreground">
        {t("playlist.songCount", { count: props.genre.songCount ?? 0 })}
      </p>
    </A>
  );
}

export default function GenresPage() {
  const servers = useServers();
  const [filter, setFilter] = createSignal("");

  const [genres, { refetch: reloadGenres }] = createResource(
    () => servers.client() ?? undefined,
    async (client) =>
      (await client.getGenres())
        .filter((genre) => genre.value)
        .sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0)),
  );

  const visible = createMemo(() => {
    const term = filter().trim().toLowerCase();
    const list = genres() ?? [];
    return term
      ? list.filter((genre) => genre.value.toLowerCase().includes(term))
      : list;
  });

  return (
    <Page>
      <PageHeader
        title={t("genres.title")}
        actions={
          <div class="relative w-56">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter()}
              onInput={(event) => setFilter(event.currentTarget.value)}
              placeholder={t("genres.filter")}
              aria-label={t("genres.filter")}
              class="pl-9"
              spellcheck={false}
              autocomplete="off"
            />
          </div>
        }
      />

      <Show
        when={!genres.loading}
        fallback={
          <div class="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!genres.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(genres.error) as MessageKey)}
              onRetry={() => reloadGenres()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={visible().length}
            fallback={
              <EmptyState
                icon={<Tags class="size-5" />}
                title={
                  filter().trim()
                    ? t("genres.noMatch", { query: filter().trim() })
                    : t("genres.empty")
                }
              />
            }
          >
            <div class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
              {visible().map((genre) => (
                <GenreTile genre={genre} />
              ))}
            </div>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
