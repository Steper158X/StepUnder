import { useParams } from "@solidjs/router";
import { createResource, createSignal, Show } from "solid-js";
import { Disc3, LoaderCircle, Shuffle, Tags } from "lucide-solid";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Page, Section } from "~/components/layout-bits";
import { AlbumGrid } from "~/components/album-card";
import { EmptyState, ErrorState, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";

function decodeParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function GenrePage() {
  const params = useParams();
  const servers = useServers();
  const player = usePlayer();
  const [starting, setStarting] = createSignal(false);

  const name = () => (params.name ? decodeParam(params.name) : "");

  const [albums, { refetch: reloadAlbums }] = createResource(
    () => (servers.client() && name() ? name() : undefined),
    (genre) => servers.client()!.getAlbumsByGenre(genre, 500, 0),
  );

  async function shuffleGenre() {
    const client = servers.client();
    if (!client || starting()) return;
    setStarting(true);
    try {
      const songs = await client.getSongsByGenre(name(), 200);
      if (!songs.length) return;
      player.playNow(shuffled(songs), 0, name());
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setStarting(false);
    }
  }

  return (
    <Page>
      <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Tags class="size-3.5" />
            {t("nav.genres")}
          </p>
          <h1 class="mt-1 truncate text-2xl font-bold sm:text-3xl">{name()}</h1>
          <Show when={albums()}>
            <p class="mt-1 text-sm text-muted-foreground">
              {albums()!.length} {t("units.albums")}
            </p>
          </Show>
        </div>
        <Button onClick={() => void shuffleGenre()} disabled={starting()}>
          <Show
            when={!starting()}
            fallback={<LoaderCircle class="size-4 animate-spin" />}
          >
            <Shuffle class="size-4" />
          </Show>
          {t("genre.shuffle")}
        </Button>
      </div>

      <Show
        when={!albums.loading}
        fallback={
          <div class="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <Show
          when={!albums.error}
          fallback={
            <ErrorState
              message={t(subsonicErrorKey(albums.error) as MessageKey)}
              onRetry={() => reloadAlbums()}
              retryLabel={t("action.retry")}
            />
          }
        >
          <Show
            when={albums()?.length}
            fallback={
              <EmptyState
                icon={<Disc3 class="size-5" />}
                title={t("genre.noAlbums")}
              />
            }
          >
            <Section title={t("genre.albums")}>
              <AlbumGrid albums={albums()!} />
            </Section>
          </Show>
        </Show>
      </Show>
    </Page>
  );
}
