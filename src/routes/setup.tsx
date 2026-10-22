import { A, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { useServers } from "~/state/servers";
import { t } from "~/i18n";
import { toast } from "~/components/toaster";
import { ServerForm } from "~/components/server-form";
import { Card, CardContent } from "~/components/ui/card";
import { Spinner } from "~/components/common";
import logo from "~/assets/logo.svg";

export default function SetupPage() {
  const servers = useServers();
  const navigate = useNavigate();

  return (
    <div class="relative flex min-h-full items-center justify-center overflow-y-auto p-6">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(124,58,237,0.18),transparent_70%)]" />
      <div class="relative w-full max-w-lg py-6">
        <div class="mb-6 flex flex-col items-center text-center">
          <img
            src={logo}
            alt=""
            class="mb-3 size-12 rounded-2xl shadow-lg"
            draggable={false}
          />
          <h1 class="text-2xl font-bold tracking-tight">{t("setup.title")}</h1>
          <p class="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {t("setup.subtitle")}
          </p>
        </div>

        <Show
          when={servers.ready()}
          fallback={
            <div class="flex justify-center py-10">
              <Spinner />
            </div>
          }
        >
          <Card class="shadow-xl">
            <CardContent class="p-5 pt-5">
              <Show when={servers.servers().length === 0}>
                <p class="mb-4 text-xs text-muted-foreground">
                  {t("setup.firstRunHint")}
                </p>
              </Show>
              <ServerForm
                showCancel={false}
                submitLabel={t("action.connect")}
                onSubmit={async (input) => {
                  const server = await servers.addServer(input);
                  toast(
                    t("toast.connected", { name: server.name }),
                    undefined,
                    "success",
                  );
                  navigate("/", { replace: true });
                }}
              />
            </CardContent>
          </Card>
        </Show>

        <Show when={servers.servers().length > 0}>
          <p class="mt-4 text-center text-xs text-muted-foreground">
            <A href="/servers" class="font-medium text-primary hover:underline">
              {t("servers.manage")}
            </A>
            <span class="mx-1.5">•</span>
            {t("setup.savedServers")}: {servers.servers().length}
          </p>
        </Show>
      </div>
    </div>
  );
}
