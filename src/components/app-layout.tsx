import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Show } from "solid-js";
import { useServers } from "~/state/servers";
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
        <div class="flex h-full flex-col overflow-hidden">
          <div class="relative flex min-h-0 flex-1">
            <Sidebar />
            <main class="min-w-0 flex-1 overflow-y-auto">
              <MobileHeader />
              {props.children}
            </main>
            <QueuePanel />
            <NowPlaying />
          </div>
          <PlayerBar />
        </div>
      </Show>
    </Show>
  );
}
