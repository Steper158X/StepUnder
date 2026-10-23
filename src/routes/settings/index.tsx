import { A } from "@solidjs/router";
import { For } from "solid-js";
import { ChevronRight, Info, Music, Palette, Server } from "lucide-solid";
import { t, type MessageKey } from "~/i18n";
import { Page, PageHeader } from "~/components/layout-bits";
import { Card } from "~/components/ui/card";

const categories: Array<{
  href: string;
  icon: typeof Palette;
  title: MessageKey;
  description: MessageKey;
}> = [
  {
    href: "/settings/appearance",
    icon: Palette,
    title: "settings.appearance",
    description: "settings.appearanceDesc",
  },
  {
    href: "/settings/playback",
    icon: Music,
    title: "settings.playback",
    description: "settings.playbackDesc",
  },
  {
    href: "/settings/servers",
    icon: Server,
    title: "settings.servers",
    description: "settings.serversDesc",
  },
  {
    href: "/settings/about",
    icon: Info,
    title: "settings.about",
    description: "settings.aboutDesc",
  },
];

export default function SettingsPage() {
  return (
    <Page class="max-w-3xl">
      <PageHeader title={t("settings.title")} />

      <Card class="divide-y divide-border/60 overflow-hidden">
        <For each={categories}>
          {(category) => {
            const Icon = category.icon;
            return (
              <A
                href={category.href}
                class="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-accent/60"
              >
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Icon class="size-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{t(category.title)}</p>
                  <p class="truncate text-xs text-muted-foreground">
                    {t(category.description)}
                  </p>
                </div>
                <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
              </A>
            );
          }}
        </For>
      </Card>
    </Page>
  );
}
