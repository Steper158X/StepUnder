import { createEffect, createMemo, createSignal, on, Show } from "solid-js";
import { Music } from "lucide-solid";
import { useServers } from "~/state/servers";
import { cn } from "~/lib/utils";

export function Cover(props: {
  coverArtId?: string;
  size?: number;
  alt?: string;
  class?: string;
  iconClass?: string;
}) {
  const servers = useServers();
  const [failed, setFailed] = createSignal(false);

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

  return (
    <div
      class={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-muted",
        props.class,
      )}
    >
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
          draggable={false}
          class="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </Show>
    </div>
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
