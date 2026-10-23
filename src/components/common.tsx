import { createEffect, createMemo, createSignal, on, Show } from "solid-js";
import { Music, X } from "lucide-solid";
import { useServers } from "~/state/servers";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import { initials } from "~/lib/format";
import { Dialog } from "~/components/ui/dialog";

/**
 * Round artist picture. Navidrome serves artist images through getCoverArt
 * (`ar-<id>`); falls back to the artist's initials when there is none.
 */
export function ArtistAvatar(props: {
  id?: string;
  name?: string;
  coverArt?: string;
  size?: number;
  class?: string;
}) {
  const servers = useServers();
  const [failed, setFailed] = createSignal(false);

  createEffect(
    on(
      () => props.coverArt ?? props.id,
      () => setFailed(false),
      { defer: true },
    ),
  );

  const url = createMemo(() => {
    const client = servers.client();
    const id = props.coverArt ?? (props.id ? `ar-${props.id}` : undefined);
    if (!client || !id || failed()) return null;
    return client.coverUrl(id, props.size ?? 300);
  });

  return (
    <div
      class={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-secondary via-muted to-secondary/70 font-semibold text-muted-foreground",
        props.class,
      )}
    >
      <Show when={url()} fallback={initials(props.name)}>
        <img
          src={url()!}
          alt={props.name ?? ""}
          loading="lazy"
          decoding="async"
          draggable={false}
          class="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </Show>
    </div>
  );
}

const coverBaseClass =
  "relative flex shrink-0 items-center justify-center overflow-hidden bg-muted";

export function Cover(props: {
  coverArtId?: string;
  size?: number;
  alt?: string;
  class?: string;
  iconClass?: string;
  /** Click to open the artwork full-screen. */
  zoomable?: boolean;
}) {
  const servers = useServers();
  const [failed, setFailed] = createSignal(false);
  const [open, setOpen] = createSignal(false);

  createEffect(
    on(
      () => props.coverArtId,
      () => setFailed(false),
      { defer: true },
    ),
  );

  const url = createMemo(() => {
    const client = servers.client();
    const id = props.coverArtId;
    if (!client || !id || failed()) return null;
    return client.coverUrl(id, props.size ?? 300);
  });

  // Full-resolution artwork for the lightbox (independent of the thumbnail size).
  const fullUrl = createMemo(() => {
    const client = servers.client();
    const id = props.coverArtId;
    if (!client || !id || failed()) return null;
    return client.coverUrl(id, Math.max(props.size ?? 300, 1200));
  });

  const image = () => (
    <Show
      when={url()}
      fallback={
        <div class="flex size-full items-center justify-center bg-gradient-to-br from-secondary via-muted to-secondary/60 text-muted-foreground">
          <Music class={cn("size-6 opacity-70", props.iconClass)} />
        </div>
      }
    >
      <img
        src={url()!}
        alt={props.alt ?? ""}
        loading="lazy"
        decoding="async"
        draggable={false}
        class={cn(
          "size-full object-cover",
          props.zoomable &&
            "transition-transform duration-500 ease-out group-hover:scale-[1.05]",
        )}
        onError={() => setFailed(true)}
      />
    </Show>
  );

  return (
    <Show
      when={props.zoomable && url()}
      fallback={<div class={cn(coverBaseClass, props.class)}>{image()}</div>}
    >
      <Dialog open={open()} onOpenChange={setOpen}>
        <Dialog.Trigger
          class={cn(
            coverBaseClass,
            "cover-shine group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
            props.class,
          )}
          aria-label={t("action.viewCover")}
        >
          {image()}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-50 animate-fade-in bg-black/90 backdrop-blur-sm" />
          <Dialog.Content
            class="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none sm:p-10"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <Dialog.Title class="sr-only">
              {props.alt ?? t("action.viewCover")}
            </Dialog.Title>
            <Dialog.CloseButton
              class="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label={t("action.close")}
            >
              <X class="size-5" />
            </Dialog.CloseButton>
            <Show when={fullUrl()}>
              <img
                src={fullUrl()!}
                alt={props.alt ?? ""}
                draggable={false}
                class="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
              />
            </Show>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Show>
  );
}

export function PlayingBars(props: { paused?: boolean; class?: string }) {
  return (
    <div
      class={cn("flex h-3.5 items-end justify-center gap-[2px]", props.class)}
      aria-hidden="true"
    >
      {[0, 1, 2].map((bar) => (
        <span
          class={cn(
            "w-[2px] rounded-full bg-primary",
            !props.paused && "eq-bar",
          )}
          style={{
            height: bar === 1 ? "100%" : bar === 0 ? "60%" : "80%",
          }}
        />
      ))}
    </div>
  );
}

export function Spinner(props: { class?: string }) {
  return (
    <div
      class={cn(
        "size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary",
        props.class,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState(props: {
  icon?: import("solid-js").JSX.Element;
  title: string;
  description?: string;
  children?: import("solid-js").JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 px-6 py-14 text-center",
        props.class,
      )}
    >
      <Show when={props.icon}>
        <div class="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {props.icon}
        </div>
      </Show>
      <div class="space-y-1">
        <p class="text-sm font-medium">{props.title}</p>
        <Show when={props.description}>
          <p class="mx-auto max-w-sm text-xs text-muted-foreground">
            {props.description}
          </p>
        </Show>
      </div>
      {props.children}
    </div>
  );
}

export function ErrorState(props: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <EmptyState
      title={props.message}
      icon={<Music class="size-5" />}
      class="border-destructive/30"
    >
      <Show when={props.onRetry}>
        <button
          type="button"
          class="text-xs font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => props.onRetry?.()}
        >
          {props.retryLabel}
        </button>
      </Show>
    </EmptyState>
  );
}
