import { A, useLocation, useNavigate } from "@solidjs/router";
import { For, Show, onMount, onCleanup } from "solid-js";
import {
  Disc3,
  Download,
  Ellipsis,
  Heart,
  House,
  Library,
  ListMusic,
  Search,
  Settings,
  Tags,
  UserRound,
  Users,
} from "lucide-solid";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Logo } from "~/components/logo";
import { cn } from "~/lib/utils";
import { holdKeyboardFocus } from "~/lib/keyboard";

const navItems = [
  { href: "/search", labelKey: "nav.search" as MessageKey, icon: Search },
  { href: "/", labelKey: "nav.home" as MessageKey, icon: House, end: true },
  {
    href: "/favorites",
    labelKey: "nav.favorites" as MessageKey,
    icon: Heart,
  },
  { href: "/albums", labelKey: "nav.albums" as MessageKey, icon: Disc3 },
  { href: "/artists", labelKey: "nav.artists" as MessageKey, icon: Users },
  { href: "/genres", labelKey: "nav.genres" as MessageKey, icon: Tags },
  {
    href: "/playlists",
    labelKey: "nav.playlists" as MessageKey,
    icon: ListMusic,
  },
  {
    href: "/downloads",
    labelKey: "nav.downloads" as MessageKey,
    icon: Download,
  },
];

function NavLink(props: {
  href: string;
  label: string;
  icon: typeof House;
  end?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = props.icon;
  return (
    <A
      href={props.href}
      end={props.end}
      onClick={() => props.onNavigate?.()}
      activeClass="bg-accent text-foreground"
      inactiveClass="text-muted-foreground"
      class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground max-md:py-2.5"
    >
      <Icon class="size-4" />
      {props.label}
    </A>
  );
}

function Brand() {
  return (
    <div class="flex min-w-0 flex-1 items-center gap-2.5">
      <Logo class="size-8 shrink-0 rounded-lg shadow-sm" />
      <div class="min-w-0 leading-tight">
        <p class="truncate text-sm font-semibold">{t("app.name")}</p>
        <p class="truncate text-[10px] text-muted-foreground">
          {t("app.tagline")}
        </p>
      </div>
    </div>
  );
}

/** "⋯" menu beside the brand holding Profile and Settings. */
function BrandMenu(props: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const go = (href: string) => {
    props.onNavigate?.();
    navigate(href);
  };

  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger
        class="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[expanded]:bg-accent data-[expanded]:text-foreground"
        aria-label={t("action.more")}
        title={t("action.more")}
      >
        <Ellipsis class="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => go("/profile")}>
          <UserRound />
          {t("nav.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/settings")}>
          <Settings />
          {t("nav.settings")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavSections(props: { onNavigate?: () => void }) {
  return (
    <nav class="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
      <For each={navItems}>
        {(item) => (
          <NavLink
            href={item.href}
            label={t(item.labelKey)}
            icon={item.icon}
            end={item.end}
            onNavigate={props.onNavigate}
          />
        )}
      </For>
    </nav>
  );
}

/** Routes that light up the Library tab: everything reached from /library. */
const libraryRoutes = [
  "/library",
  "/favorites",
  "/album",
  "/artist",
  "/playlist",
  "/genre",
  "/downloads",
];

const mobileTabs: Array<{
  href: string;
  labelKey: MessageKey;
  icon: typeof House;
  match: (path: string) => boolean;
}> = [
  { href: "/", labelKey: "nav.home", icon: House, match: (path) => path === "/" },
  {
    href: "/search",
    labelKey: "nav.search",
    icon: Search,
    match: (path) => path.startsWith("/search"),
  },
  {
    href: "/library",
    labelKey: "nav.library",
    icon: Library,
    match: (path) => libraryRoutes.some((route) => path.startsWith(route)),
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    match: (path) =>
      path.startsWith("/settings") || path.startsWith("/profile"),
  },
];

/** Bottom tab bar for phones. Hidden while the full screen player is open. */
export function MobileNav() {
  const player = usePlayer();
  const location = useLocation();

  return (
    <Show when={!player.nowPlayingOpen()}>
      <nav class="glass-bar grid shrink-0 grid-cols-4 border-t border-border/60 bg-card/80 backdrop-blur md:hidden">
        <For each={mobileTabs}>
          {(tab) => {
            const Icon = tab.icon;
            const active = () => tab.match(location.pathname);
            return (
              <A
                href={tab.href}
                aria-current={active() ? "page" : undefined}
                onClick={
                  tab.href === "/search" ? () => holdKeyboardFocus() : undefined
                }
                class={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active()
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon class="size-5" />
                <span class="max-w-full truncate px-1">{t(tab.labelKey)}</span>
              </A>
            );
          }}
        </For>
      </nav>
    </Show>
  );
}

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
    <aside class="glass-bar glass-inset mb-[var(--player-space,0px)] hidden w-56 shrink-0 flex-col border-r border-border/60 bg-card/25 md:flex">
      <div class="flex h-14 items-center justify-between gap-1 pl-4 pr-2">
        <Brand />
        <BrandMenu />
      </div>

      <NavSections />
    </aside>
  );
}
