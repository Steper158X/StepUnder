import { A, useNavigate } from "@solidjs/router";
import { For, Show, onMount, onCleanup } from "solid-js";
import {
  ChevronDown,
  Disc3,
  House,
  Languages,
  ListMusic,
  Search,
  Server,
  Settings,
  Users,
} from "lucide-solid";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { locale, setLocale } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const navItems = [
  { href: "/", labelKey: "nav.home" as MessageKey, icon: House, end: true },
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
  const servers = useServers();
  const player = usePlayer();
  const navigate = useNavigate();

  async function switchServer(id: string) {
    if (id === servers.activeId()) return;
    try {
      const result = await servers.connect(id);
      if (result === "need-password") {
        navigate("/servers");
      }
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    }
  }

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

      <div class="px-2 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            class="flex w-full items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-2 text-left transition-colors hover:bg-accent/60"
            aria-label={t("servers.switchServer")}
          >
            <span
              class={cn(
                "size-1.5 shrink-0 rounded-full",
                servers.client() ? "bg-emerald-500" : "bg-muted-foreground/50",
              )}
            />
            <Server class="size-3.5 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium">
                {servers.activeServer()?.name ?? t("empty.noServer")}
              </span>
              <span class="block truncate text-[10px] text-muted-foreground">
                {servers.activeServer()?.url ?? ""}
              </span>
            </span>
            <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <DropdownMenuLabel>{t("servers.title")}</DropdownMenuLabel>
            <For each={servers.servers()}>
              {(server) => (
                <DropdownMenuItem
                  onSelect={() => void switchServer(server.id)}
                  class="justify-between"
                >
                  <span class="truncate">{server.name}</span>
                  <Show when={server.id === servers.activeId()}>
                    <span class="size-1.5 rounded-full bg-emerald-500" />
                  </Show>
                </DropdownMenuItem>
              )}
            </For>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/servers")}>
              <Settings class="size-4" />
              {t("servers.manage")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
