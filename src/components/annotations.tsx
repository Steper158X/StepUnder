import { For, Show, createSignal } from "solid-js";
import { Heart, Star, X } from "lucide-solid";
import { usePlayer } from "~/player/store";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { cn } from "~/lib/utils";
import { isMobile } from "~/lib/platform";
import { toast } from "~/components/toaster";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "~/components/ui/context-menu";

/** A song or album: anything Subsonic can star and rate by id. */
export type Annotatable = { id: string; starred?: string; userRating?: number };

/** Rating state for one item, shared through the player store. */
export function useRating(item: () => Annotatable) {
  const servers = useServers();
  const player = usePlayer();
  const rating = () => player.ratingOf(item());

  async function rate(value: number) {
    const client = servers.client();
    if (!client) return;
    const id = item().id;
    const previous = rating();
    if (value === previous) return;
    player.patchSongRating(id, value);
    try {
      await client.setRating(id, value);
      toast(
        value ? t("toast.rated", { count: value }) : t("toast.ratingCleared"),
        undefined,
        "success",
      );
    } catch (error) {
      player.patchSongRating(id, previous);
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    }
  }

  return { rating, rate };
}

/** Favorite state for one item, shared through the player store. */
export function useStar(
  item: () => Annotatable,
  options: { onStarred?: () => void } = {},
) {
  const servers = useServers();
  const player = usePlayer();
  const [busy, setBusy] = createSignal(false);
  const starred = () => player.isStarred(item());

  async function toggle() {
    const client = servers.client();
    if (!client || busy()) return;
    setBusy(true);
    const id = item().id;
    const next = !starred();
    try {
      if (next) await client.star(id);
      else await client.unstar(id);
      player.patchSongStar(id, next);
      // Phones show the filled heart; a toast would cover the controls.
      if (!isMobile) {
        toast(t(next ? "toast.starred" : "toast.unstarred"), undefined, "success");
      }
      if (next) options.onStarred?.();
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  return { starred, toggle, busy };
}

/** "Favorite / Remove from favorites" item for a context menu. */
export function StarMenuItem(props: {
  item: Annotatable;
  onStarred?: () => void;
}) {
  const { starred, toggle } = useStar(() => props.item, {
    onStarred: () => props.onStarred?.(),
  });
  return (
    <ContextMenuItem onSelect={() => void toggle()}>
      <Heart class={cn("size-4", starred() && "fill-current text-primary")} />
      {t(starred() ? "action.unlike" : "action.like")}
    </ContextMenuItem>
  );
}

/** "Rating ▸" submenu with 5…1 stars and a clear option. */
export function RatingSubmenu(props: { item: Annotatable }) {
  const { rating, rate } = useRating(() => props.item);

  return (
    <ContextMenuSub overlap gutter={4}>
      <ContextMenuSubTrigger>
        <Star class={cn("size-4", rating() > 0 && "fill-current text-primary")} />
        {t("action.rate")}
        <Show when={rating() > 0}>
          <span class="ml-2 text-xs tabular-nums text-muted-foreground">
            {rating()}/5
          </span>
        </Show>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <For each={[5, 4, 3, 2, 1]}>
          {(value) => (
            <ContextMenuItem onSelect={() => void rate(value)}>
              <span
                class={cn(
                  "flex gap-0.5",
                  rating() === value ? "text-primary" : "text-muted-foreground",
                )}
              >
                <For each={[1, 2, 3, 4, 5]}>
                  {(i) => (
                    <Star class={cn("!size-3.5", i <= value && "fill-current")} />
                  )}
                </For>
              </span>
              <span class={cn("ml-1", rating() === value && "font-medium")}>
                {value === 1
                  ? t("rating.oneStar")
                  : t("rating.stars", { count: value })}
              </span>
            </ContextMenuItem>
          )}
        </For>
        <Show when={rating() > 0}>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void rate(0)}>
            <X class="size-4" />
            {t("rating.clear")}
          </ContextMenuItem>
        </Show>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

/**
 * Inline row of five clickable stars. Clicking the current rating clears it.
 */
export function RatingStars(props: { item: Annotatable; class?: string }) {
  const { rating, rate } = useRating(() => props.item);
  const [hover, setHover] = createSignal(0);
  const shown = () => hover() || rating();

  return (
    <div
      class={cn("flex items-center", props.class)}
      role="radiogroup"
      aria-label={t("action.rate")}
      onMouseLeave={() => setHover(0)}
    >
      <For each={[1, 2, 3, 4, 5]}>
        {(value) => (
          <button
            type="button"
            role="radio"
            aria-checked={rating() === value}
            class={cn(
              "rounded p-0.5 transition-colors",
              value <= shown() ? "text-primary" : "text-muted-foreground/60",
              "hover:text-primary",
            )}
            title={
              rating() === value
                ? t("rating.clear")
                : value === 1
                  ? t("rating.oneStar")
                  : t("rating.stars", { count: value })
            }
            onMouseEnter={() => setHover(value)}
            onClick={() => void rate(rating() === value ? 0 : value)}
          >
            <Star class={cn("size-4", value <= shown() && "fill-current")} />
          </button>
        )}
      </For>
    </div>
  );
}
