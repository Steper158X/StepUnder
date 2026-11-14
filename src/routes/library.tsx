import { A } from "@solidjs/router";
import { For } from "solid-js";
import {
  ChevronRight,
  Disc3,
  Download,
  Heart,
  ListMusic,
  Tags,
  Users,
} from "lucide-solid";
import { t, type MessageKey } from "~/i18n";
import { Page, PageHeader } from "~/components/layout-bits";
import { Card } from "~/components/ui/card";

/** Everything the phone's bottom bar has no room for. */
export const libraryItems: Array<{
  href: string;
  icon: typeof Heart;
  title: MessageKey;
}> = [
  { href: "/favorites", icon: Heart, title: "nav.favorites" },
  { href: "/playlists", icon: ListMusic, title: "nav.playlists" },
  { href: "/albums", icon: Disc3, title: "nav.albums" },
  { href: "/artists", icon: Users, title: "nav.artists" },
  { href: "/genres", icon: Tags, title: "nav.genres" },
  { href: "/downloads", icon: Download, title: "nav.downloads" },
];

export default function LibraryPage() {
  return (
    <Page class="max-w-3xl">
      <PageHeader title={t("nav.library")} />

      <Card class="divide-y divide-border/60 overflow-hidden">
        <For each={libraryItems}>
          {(item) => {
            const Icon = item.icon;
            return (
              <A
                href={item.href}
                class="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-accent/60"
              >
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Icon class="size-4" />
                </div>
                <p class="min-w-0 flex-1 truncate text-sm font-medium">
                  {t(item.title)}
                </p>
                <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
              </A>
            );
          }}
        </For>
      </Card>
    </Page>
  );
}
