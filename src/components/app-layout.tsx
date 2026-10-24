import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { useServers } from "~/state/servers";
import { playerLayout } from "~/state/settings";
import { t } from "~/i18n";
import { MobileHeader, Sidebar } from "~/components/sidebar";
import { PlayerBar } from "~/components/player-bar";
import { NowPlaying } from "~/components/now-playing";
import { QueuePanel } from "~/components/queue-panel";
import { Spinner } from "~/components/common";
import logo from "~/assets/logo.svg";

function BootScreen() {
  return (
    <div class="flex h-full flex-col items-center justify-center gap-4">
      <img
        src={logo}
        alt=""
        class="size-12 rounded-2xl shadow-lg"
        draggable={false}
      />
      <Spinner />
      <p class="text-xs text-muted-foreground">{t("common.loading")}</p>
    </div>
  );
}

export function AppLayout(props: RouteSectionProps) {
  const servers = useServers();
  const floating = () => playerLayout() === "floating";
  const [bar, setBar] = createSignal<HTMLDivElement>();
  const [barSpace, setBarSpace] = createSignal(0);

  // A floating bar overlaps the content, so scroll areas reserve its height
  // (plus the gap below it) through `--player-space`.
  createEffect(() => {
    const element = bar();
    if (!floating() || !element) {
      setBarSpace(0);
      return;
    }
    const observer = new ResizeObserver(() => {
      const bottomGap =
        element.offsetParent instanceof HTMLElement
          ? element.offsetParent.clientHeight -
            element.offsetTop -
            element.offsetHeight
          : 0;
      setBarSpace(element.offsetHeight + bottomGap * 2);
    });
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  return (
    <Show when={servers.ready()} fallback={<BootScreen />}>
      <Show
        when={servers.client()}
        fallback={
          <Navigate
            href={servers.servers().length > 0 ? "/servers" : "/setup"}
          />
        }
      >
        <div
          class="relative flex h-full flex-col overflow-hidden"
          style={
            floating() ? { "--player-space": `${barSpace()}px` } : undefined
          }
        >
          <div class="relative isolate flex min-h-0 flex-1">
            <Sidebar />
            <main class="min-w-0 flex-1 overflow-y-auto">
              <MobileHeader />
              {props.children}
              <Show when={floating()}>
                <div aria-hidden="true" style={{ height: `${barSpace()}px` }} />
              </Show>
            </main>
            <QueuePanel />
            <NowPlaying />
          </div>
          <PlayerBar floating={floating()} ref={setBar} />
        </div>
      </Show>
    </Show>
  );
}
