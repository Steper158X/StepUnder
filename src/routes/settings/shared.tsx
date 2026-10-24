import { A } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { ChevronLeft } from "lucide-solid";
import { t } from "~/i18n";
import { Page } from "~/components/layout-bits";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function Row(props: {
  label: string;
  description?: string;
  children: JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={cn(
        "flex flex-wrap items-center justify-between gap-3 py-3.5",
        props.class,
      )}
    >
      <div class="min-w-0">
        <p class="text-sm font-medium">{props.label}</p>
        <Show when={props.description}>
          <p class="mt-0.5 max-w-md text-xs text-muted-foreground">
            {props.description}
          </p>
        </Show>
      </div>
      <div class="flex items-center gap-2">{props.children}</div>
    </div>
  );
}

/** A titled card of rows, for a group that sits below the page's main card. */
export function SettingsSection(props: {
  title: string;
  icon?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section class="mt-6">
      <h2 class="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
        {props.icon}
        {props.title}
      </h2>
      <Card>
        <CardContent class="divide-y divide-border/60 py-1">
          {props.children}
        </CardContent>
      </Card>
    </section>
  );
}

/** Layout for a settings category: back link to the list, title, then a card. */
export function SettingsSubPage(props: {
  title: string;
  actions?: JSX.Element;
  children: JSX.Element;
  /** Extra `SettingsSection`s below the main card. */
  sections?: JSX.Element;
}) {
  return (
    <Page class="max-w-3xl">
      <A
        href="/settings"
        class="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft class="size-4" />
        {t("settings.title")}
      </A>
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 class="truncate text-2xl font-bold tracking-tight">
          {props.title}
        </h1>
        <Show when={props.actions}>
          <div class="flex items-center gap-2">{props.actions}</div>
        </Show>
      </div>
      <Card>
        <CardContent class="divide-y divide-border/60 py-1">
          {props.children}
        </CardContent>
      </Card>
      {props.sections}
    </Page>
  );
}
