import { A } from "@solidjs/router";
import { For, createSignal, onMount, onCleanup } from "solid-js";
import {
  Disc3,
  Heart,
  House,
  ListMusic,
  Menu,
  Search,
  Settings,
  UserRound,
  Users,
  X,
} from "lucide-solid";
import { usePlayer } from "~/player/store";
import { t, type MessageKey } from "~/i18n";
import { Dialog } from "~/components/ui/dialog";
import logo from "~/assets/logo.svg";

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
    <div class="flex items-center gap-2.5">
      <img
        src={logo}
        alt=""
        class="size-8 shrink-0 rounded-lg shadow-sm"
        draggable={false}
      />
      <div class="min-w-0 leading-tight">
        <p class="truncate text-sm font-semibold">{t("app.name")}</p>
        <p class="truncate text-[10px] text-muted-foreground">
          {t("app.tagline")}
        </p>
      </div>
    </div>
  );
}

function NavSections(props: { onNavigate?: () => void }) {
  return (
    <>
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

      <div class="space-y-0.5 border-t border-border/60 p-2">
        <NavLink
          href="/profile"
          label={t("nav.profile")}
          icon={UserRound}
          onNavigate={props.onNavigate}
        />
        <NavLink
          href="/settings"
          label={t("nav.settings")}
          icon={Settings}
          onNavigate={props.onNavigate}
        />
      </div>
    </>
  );
}

/** Compact top bar with a slide-over menu, shown below the md breakpoint. */
export function MobileHeader() {
  const [open, setOpen] = createSignal(false);

  return (
    <header class="sticky top-0 z-30 flex h-12 items-center gap-1.5 border-b border-border/60 bg-background/85 px-2 backdrop-blur md:hidden">
      <Dialog open={open()} onOpenChange={setOpen}>
        <Dialog.Trigger
          class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("action.openMenu")}
        >
          <Menu class="size-5" />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-50 animate-fade-in bg-black/60 backdrop-blur-[2px]" />
          <Dialog.Content class="fixed inset-y-0 left-0 z-50 flex w-[min(17rem,85vw)] animate-slide-in-left flex-col border-r border-border/60 bg-card shadow-2xl outline-none">
            <Dialog.Title class="sr-only">{t("app.name")}</Dialog.Title>
            <div class="flex h-14 items-center justify-between gap-2 border-b border-border/60 px-4">
              <Brand />
              <Dialog.CloseButton
                class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("action.close")}
              >
                <X class="size-4" />
              </Dialog.CloseButton>
            </div>
            <NavSections onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <img
        src={logo}
        alt=""
        class="size-7 shrink-0 rounded-md shadow-sm"
        draggable={false}
      />
      <div class="min-w-0 leading-tight">
        <p class="truncate text-sm font-semibold">{t("app.name")}</p>
        <p class="truncate text-[10px] text-muted-foreground">
          {t("app.tagline")}
        </p>
      </div>
    </header>
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
    <aside class="hidden w-56 shrink-0 flex-col border-r border-border/60 bg-card/25 md:flex">
      <div class="flex h-14 items-center px-4">
        <Brand />
      </div>

      <NavSections />
    </aside>
  );
}
