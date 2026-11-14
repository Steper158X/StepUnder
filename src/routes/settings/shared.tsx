import { A } from "@solidjs/router";
import { For, Show, type JSX } from "solid-js";
import { ChevronLeft } from "lucide-solid";
import { t } from "~/i18n";
import { Page } from "~/components/layout-bits";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

/**
 * One setting: label and hint, then its control.
 *
 * On phones the control drops below the label and spans the row, so selects,
 * sliders and segmented buttons get a full-width touch target. Pass `inline`
 * for small controls (switches, a single button) that read better beside the
 * label on every screen size.
 */
export function Row(props: {
  label: string;
  description?: string;
  children: JSX.Element;
  class?: string;
  inline?: boolean;
}) {
  return (
    <div
      class={cn(
        "flex gap-3 py-3.5",
        props.inline
          ? "items-center justify-between"
          : "flex-col items-stretch gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3",
        props.class,
      )}
    >
      <div class="min-w-0">
        <p class="text-sm font-medium">{props.label}</p>
        <Show when={props.description}>
          <p class="mt-0.5 max-w-md break-words text-xs text-muted-foreground">
            {props.description}
          </p>
        </Show>
      </div>
      <div
        class={cn(
          "flex items-center gap-2",
          props.inline ? "shrink-0" : "max-md:w-full",
        )}
      >
        {props.children}
      </div>
    </div>
  );
}

/** Button group for picking one of a few options; fills the row on phones. */
export function Segmented<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string; icon?: JSX.Element }>;
  onChange: (value: T) => void;
}) {
  return (
    <div class="flex gap-1 rounded-lg border border-border/70 p-0.5 max-md:w-full">
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            aria-pressed={props.value === option.value}
            onClick={() => props.onChange(option.value)}
            class={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors max-md:min-w-0 max-md:flex-1 max-md:py-2",
              props.value === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            <span class="truncate">{option.label}</span>
          </button>
        )}
      </For>
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
        <CardContent class="divide-y divide-border/60 py-1 max-md:px-4">
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
        class="-ml-1 mb-2 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground max-md:py-1.5"
      >
        <ChevronLeft class="size-4" />
        {t("settings.title")}
      </A>
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3 md:items-end">
        <h1 class="min-w-0 truncate text-2xl font-bold tracking-tight">
          {props.title}
        </h1>
        <Show when={props.actions}>
          <div class="flex items-center gap-2">{props.actions}</div>
        </Show>
      </div>
      <Card>
        <CardContent class="divide-y divide-border/60 py-1 max-md:px-4">
          {props.children}
        </CardContent>
      </Card>
      {props.sections}
    </Page>
  );
}
