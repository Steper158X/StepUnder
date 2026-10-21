import { Navigate, type RouteSectionProps } from "@solidjs/router";
import { Show } from "solid-js";
import { ListMusic } from "lucide-solid";
import { useServers } from "~/state/servers";
import { t } from "~/i18n";
import { Sidebar } from "~/components/sidebar";
import { PlayerBar } from "~/components/player-bar";
import { QueuePanel } from "~/components/queue-panel";
import { Spinner } from "~/components/common";

function BootScreen() {
  return (
    <div class="flex h-full flex-col items-center justify-center gap-4">
      <div class="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <ListMusic class="size-6" />
      </div>
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
          <div class="flex min-h-0 flex-1">
            <Sidebar />
            <main class="min-w-0 flex-1 overflow-y-auto">{props.children}</main>
            <QueuePanel />
          </div>
          <PlayerBar />
        </div>
      </Show>
    </Show>
  );
}
