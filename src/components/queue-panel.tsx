import { For, Show } from "solid-js";
import { ListMusic, Play, Trash2, X } from "lucide-solid";
import { usePlayer } from "~/player/store";
import { t } from "~/i18n";
import { formatTime } from "~/lib/format";
import { cn } from "~/lib/utils";
import { Cover, EmptyState, PlayingBars } from "~/components/common";
import { Button } from "~/components/ui/button";

export function QueuePanel() {
  const player = usePlayer();

  return (
    <Show when={player.queueOpen()}>
      <div
        class="fixed inset-0 z-40 animate-fade-in bg-black/50"
        onClick={() => player.setQueueOpen(false)}
      />
      <aside class="fixed right-0 top-0 z-50 flex h-full w-[22rem] max-w-[92vw] animate-slide-in-right flex-col border-l border-border/70 bg-card shadow-2xl">
        <div class="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
          <div class="flex items-center gap-2">
            <ListMusic class="size-4 text-muted-foreground" />
            <h2 class="text-sm font-semibold">{t("player.queue")}</h2>
            <span class="text-xs text-muted-foreground">
              {player.state.queue.length}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Show when={player.state.queue.length > 0}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => player.clearQueue()}
              >
                {t("player.clearQueue")}
              </Button>
            </Show>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => player.setQueueOpen(false)}
              aria-label={t("action.close")}
            >
              <X class="size-4" />
            </Button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <Show
            when={player.state.queue.length > 0}
            fallback={
              <EmptyState
                icon={<ListMusic class="size-5" />}
                title={t("player.queueEmpty")}
                description={t("player.queueEmptyHint")}
                class="mt-6 border-none"
              />
            }
          >
            <For each={player.state.queue}>
              {(song, index) => {
                const isCurrent = () => index() === player.state.index;
                return (
                  <div
                    class={cn(
                      "group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent/60",
                      isCurrent() && "bg-accent/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => player.jumpTo(index())}
                      class="relative size-9 shrink-0 overflow-hidden rounded"
                      aria-label={t("action.play")}
                    >
                      <Cover
                        coverArtId={song.coverArt}
                        size={64}
                        alt={song.album ?? song.title}
                        class="size-9 rounded"
                      />
                      <Show when={isCurrent()}>
                        <span class="absolute inset-0 flex items-center justify-center bg-black/55">
                          <PlayingBars paused={!player.state.playing} />
                        </span>
                      </Show>
                    </button>
                    <button
                      type="button"
                      onClick={() => player.jumpTo(index())}
                      class="min-w-0 flex-1 text-left"
                    >
                      <p
                        class={cn(
                          "truncate text-xs font-medium",
                          isCurrent() && "text-primary",
                        )}
                      >
                        {song.title}
                      </p>
                      <p class="truncate text-[11px] text-muted-foreground">
                        {song.artist ?? t("common.unknownArtist")}
                      </p>
                    </button>
                    <span class="text-[11px] tabular-nums text-muted-foreground">
                      {formatTime(song.duration)}
                    </span>
                    <button
                      type="button"
                      class="rounded p-1 text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
                      onClick={() => player.removeAt(index())}
                      aria-label={t("player.remove")}
                    >
                      <Trash2 class="size-3.5" />
                    </button>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>

        <div class="border-t border-border/60 p-3">
          <Button
            class="w-full"
            disabled={!player.state.queue.length}
            onClick={() => {
              player.play();
              player.setQueueOpen(false);
            }}
          >
            <Play class="size-4 fill-current" />
            {t("action.play")}
          </Button>
        </div>
      </aside>
    </Show>
  );
}
