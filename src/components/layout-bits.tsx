import { A } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { ChevronRight } from "lucide-solid";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";

export function Section(props: {
  title: string;
  href?: string;
  moreLabel?: string;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <section class={cn("space-y-3", props.class)}>
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-lg font-semibold tracking-tight">{props.title}</h2>
        <Show when={props.href}>
          <A
            href={props.href!}
            class="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {props.moreLabel ?? t("home.more")}
            <ChevronRight class="size-3.5" />
          </A>
        </Show>
      </div>
      {props.children}
    </section>
  );
}

export function Page(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={cn("mx-auto w-full max-w-[1400px] px-6 py-6", props.class)}>
      {props.children}
    </div>
  );
}

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={cn(
        "mb-5 flex flex-wrap items-end justify-between gap-3",
        props.class,
      )}
    >
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-bold tracking-tight">{props.title}</h1>
        <Show when={props.subtitle}>
          <p class="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex items-center gap-2">{props.actions}</div>
      </Show>
    </div>
  );
}
