import { useNavigate } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { LoaderCircle, LogIn, Pencil, Server } from "lucide-solid";
import { t, type MessageKey } from "~/i18n";
import { useServers } from "~/state/servers";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/select";
import { SettingsSubPage } from "./shared";

export default function ServersSettingsPage() {
  const servers = useServers();
  const navigate = useNavigate();
  const [switchingId, setSwitchingId] = createSignal<string | null>(null);

  async function switchServer(id: string, name: string) {
    if (switchingId()) return;
    setSwitchingId(id);
    try {
      const result = await servers.connect(id);
      if (result === "need-password") {
        navigate("/servers");
      } else {
        toast(t("toast.connected", { name }), undefined, "success");
      }
    } catch (error) {
      toast(t(subsonicErrorKey(error) as MessageKey), undefined, "error");
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <SettingsSubPage
      title={t("settings.servers")}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate("/servers")}>
          <Pencil class="size-3.5" />
          {t("servers.manage")}
        </Button>
      }
    >
      <Show
        when={servers.servers().length > 0}
        fallback={
          <p class="py-4 text-sm text-muted-foreground">{t("servers.empty")}</p>
        }
      >
        <For each={servers.servers()}>
          {(server) => (
            <div class="flex items-center gap-3 py-3">
              <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <Server class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{server.name}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {server.url}
                </p>
              </div>
              <Show
                when={server.id === servers.activeId() && servers.client()}
                fallback={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={switchingId() !== null}
                    onClick={() => void switchServer(server.id, server.name)}
                  >
                    <Show
                      when={switchingId() === server.id}
                      fallback={<LogIn class="size-3.5" />}
                    >
                      <LoaderCircle class="size-3.5 animate-spin" />
                    </Show>
                    {t("servers.switch")}
                  </Button>
                }
              >
                <Badge>{t("servers.active")}</Badge>
              </Show>
            </div>
          )}
        </For>
        <p class="py-3 text-xs text-muted-foreground">
          {t("settings.keychainHint")}
        </p>
      </Show>
    </SettingsSubPage>
  );
}
