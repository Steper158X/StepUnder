import { A } from "@solidjs/router";
import { For, onMount, onCleanup } from "solid-js";
import {
  Disc3,
  Heart,
  House,
  Languages,
  ListMusic,
  Search,
  Settings,
  UserRound,
  Users,
} from "lucide-solid";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { locale, setLocale } from "~/i18n";

const navItems = [
  { href: "/", labelKey: "nav.home" as MessageKey, icon: House, end: true },
  {
    href: "/favorites",
    labelKey: "nav.favorites" as MessageKey,
    icon: Heart,
  },
  { href: "/albums", labelKey: "nav.albums" as MessageKey, icon: Disc3 },
  { href: "/artists", labelKey: "nav.artists" as MessageKey, icon: Users },
  {
    href: "/playlists",
    labelKey: "nav.playlists" as MessageKey,
    icon: ListMusic,
  },
  { href: "/search", labelKey: "nav.search" as MessageKey, icon: Search },
];

export function Sidebar() {
  const player = usePlayer();

  onMount(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === "Space") {
        event.preventDefault();
        player.toggle();
      } else if (event.code === "ArrowRight" && event.shiftKey) {
        player.next();
      } else if (event.code === "ArrowLeft" && event.shiftKey) {
        player.previous();
      } else if (event.code === "ArrowRight") {
        player.seek(player.state.position + 5);
      } else if (event.code === "ArrowLeft") {
        player.seek(player.state.position - 5);
      } else if (event.code === "ArrowUp") {
        event.preventDefault();
        player.setVolume(player.state.volume + 0.05);
      } else if (event.code === "ArrowDown") {
        event.preventDefault();
        player.setVolume(player.state.volume - 0.05);
      }
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  return (
    <aside class="flex w-56 shrink-0 flex-col border-r border-border/60 bg-card/25">
      <div class="flex h-14 items-center gap-2.5 px-4">
        <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <ListMusic class="size-4" />
        </div>
        <div class="min-w-0 leading-tight">
          <p class="truncate text-sm font-semibold">{t("app.name")}</p>
          <p class="truncate text-[10px] text-muted-foreground">
            {t("app.tagline")}
          </p>
        </div>
      </div>

      <nav class="flex-1 space-y-0.5 px-2 py-1">
        <For each={navItems}>
          {(item) => {
            const Icon = item.icon;
            return (
              <A
                href={item.href}
                end={item.end}
                activeClass="bg-accent text-foreground"
                inactiveClass="text-muted-foreground"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <Icon class="size-4" />
                {t(item.labelKey)}
              </A>
            );
          }}
        </For>
      </nav>

      <div class="space-y-0.5 border-t border-border/60 p-2">
        <A
          href="/profile"
          activeClass="bg-accent text-foreground"
          inactiveClass="text-muted-foreground"
          class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <UserRound class="size-4" />
          {t("nav.profile")}
        </A>
        <A
          href="/settings"
          activeClass="bg-accent text-foreground"
          inactiveClass="text-muted-foreground"
          class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <Settings class="size-4" />
          {t("nav.settings")}
        </A>
        <button
          type="button"
          onClick={() => setLocale(locale() === "th" ? "en" : "th")}
          class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <Languages class="size-4" />
          {locale() === "th" ? "English" : "ไทย"}
        </button>
      </div>
    </aside>
  );
}
