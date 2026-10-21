import { useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createSignal } from "solid-js";
import {
  ArrowLeft,
  LoaderCircle,
  Pencil,
  Plus,
  Server,
  Trash2,
  X,
} from "lucide-solid";
import type { ServerConfig } from "~/lib/types";
import { useServers } from "~/state/servers";
import { subsonicErrorKey } from "~/lib/subsonic";
import { t, type MessageKey } from "~/i18n";
import { toast } from "~/components/toaster";
import { ServerForm } from "~/components/server-form";
import { Page, PageHeader } from "~/components/layout-bits";
import { EmptyState, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/select";
import { Card } from "~/components/ui/card";
import { Input, FieldError, Label } from "~/components/ui/input";
import { CheckboxField } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export default function ServersPage() {
  const servers = useServers();
  const navigate = useNavigate();

  createEffect(() => {
    if (servers.ready() && servers.servers().length === 0) {
      navigate("/setup", { replace: true });
    }
  });

  const [addOpen, setAddOpen] = createSignal(false);
  const [editTarget, setEditTarget] = createSignal<ServerConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<ServerConfig | null>(null);
  const [passwordTarget, setPasswordTarget] = createSignal<ServerConfig | null>(null);
  const [password, setPassword] = createSignal("");
  const [remember, setRemember] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function handleConnect(server: ServerConfig) {
    if (server.id === servers.activeId() && servers.client()) {
      navigate("/");
      return;
    }
    try {
      const result = await servers.connect(server.id);
      if (result === "need-password") {
        setPassword("");
        setRemember(server.savePassword);
        setError(null);
        setPasswordTarget(server);
      } else {
        toast(t("toast.connected", { name: server.name }), undefined, "success");
        navigate("/");
      }
    } catch (err) {
      toast(t(subsonicErrorKey(err) as MessageKey), undefined, "error");
    }
  }

  async function submitPassword(event: SubmitEvent) {
    event.preventDefault();
    const target = passwordTarget();
    if (!target) return;
    if (!password()) {
      setError(t("error.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await servers.connectWithPassword(target.id, password(), remember());
      setPasswordTarget(null);
      toast(t("toast.connected", { name: target.name }), undefined, "success");
      navigate("/");
    } catch (err) {
      setError(t(subsonicErrorKey(err) as MessageKey));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget();
    if (!target) return;
    setBusy(true);
    try {
      await servers.removeServer(target.id);
      setDeleteTarget(null);
      toast(t("toast.deleted"), undefined, "success");
    } catch (err) {
      toast(t(subsonicErrorKey(err) as MessageKey), undefined, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="min-h-full overflow-y-auto">
      <Page class="max-w-3xl">
        <div class="mb-4">
          <Show when={servers.client()}>
            <Button
              variant="ghost"
              size="sm"
              class="-ml-2 text-muted-foreground"
              onClick={() => navigate("/")}
            >
              <ArrowLeft class="size-4" />
              {t("nav.library")}
            </Button>
          </Show>
        </div>

        <PageHeader
          title={t("servers.title")}
          subtitle={t("servers.subtitle")}
          actions={
            <Button onClick={() => setAddOpen(true)}>
              <Plus class="size-4" />
              {t("servers.add")}
            </Button>
          }
        />

        <Show when={servers.startupError()}>
          <div class="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{t(servers.startupError() as MessageKey)}</span>
            <button
              type="button"
              onClick={() => servers.clearStartupError()}
              aria-label={t("action.close")}
            >
              <X class="size-4" />
            </button>
          </div>
        </Show>

        <Show
          when={servers.ready()}
          fallback={
            <div class="flex justify-center py-16">
              <Spinner />
            </div>
          }
        >
          <Show
            when={servers.servers().length > 0}
            fallback={
              <EmptyState
                icon={<Server class="size-5" />}
                title={t("servers.empty")}
                description={t("servers.emptyHint")}
              >
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus class="size-4" />
                  {t("servers.add")}
                </Button>
              </EmptyState>
            }
          >
            <div class="space-y-3">
              <For each={servers.servers()}>
                {(server) => {
                  const isActive = () =>
                    server.id === servers.activeId() && Boolean(servers.client());
                  const isConnecting = () => servers.connectingId() === server.id;
                  return (
                    <Card class="p-4">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="flex min-w-0 gap-3">
                          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                            <Server class="size-4" />
                          </div>
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <p class="truncate text-sm font-semibold">
                                {server.name}
                              </p>
                              <Show when={isActive()}>
                                <Badge>{t("servers.active")}</Badge>
                              </Show>
                              <Show when={!server.savePassword}>
                                <Badge variant="outline">
                                  {t("servers.needPassword")}
                                </Badge>
                              </Show>
                            </div>
                            <p class="mt-0.5 truncate text-xs text-muted-foreground">
                              {server.url}
                            </p>
                            <p class="truncate text-xs text-muted-foreground">
                              {server.username}
                            </p>
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={isActive() ? "secondary" : "default"}
                            disabled={isConnecting()}
                            onClick={() => void handleConnect(server)}
                          >
                            <Show when={isConnecting()}>
                              <LoaderCircle class="size-3.5 animate-spin" />
                            </Show>
                            {isActive()
                              ? t("servers.active")
                              : t("action.connect")}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("action.edit")}
                            onClick={() => setEditTarget(server)}
                          >
                            <Pencil class="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("action.delete")}
                            onClick={() => setDeleteTarget(server)}
                          >
                            <Trash2 class="size-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                }}
              </For>
            </div>
          </Show>

          <p class="mt-6 text-xs text-muted-foreground">
            {t("settings.keychainHint")}
          </p>
        </Show>
      </Page>

      <Dialog open={addOpen()} onOpenChange={setAddOpen}>
        <DialogContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("setup.addServer")}</DialogTitle>
          </DialogHeader>
          <ServerForm
            submitLabel={t("action.add")}
            onCancel={() => setAddOpen(false)}
            onSubmit={async (input) => {
              const server = await servers.addServer(input);
              setAddOpen(false);
              toast(
                t("toast.connected", { name: server.name }),
                undefined,
                "success",
              );
              navigate("/");
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editTarget())}
        onOpenChange={(open: boolean) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("setup.editServer")}</DialogTitle>
          </DialogHeader>
          <Show when={editTarget()}>
            {(server) => (
              <ServerForm
                initial={server()}
                initialPassword={servers.passwords()[server().id] ?? ""}
                submitLabel={t("action.save")}
                onCancel={() => setEditTarget(null)}
                onSubmit={async (input) => {
                  await servers.updateServer(server().id, input);
                  setEditTarget(null);
                  toast(t("toast.saved"), undefined, "success");
                }}
              />
            )}
          </Show>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget())}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("servers.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("servers.deleteDesc", { name: deleteTarget()?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy()}
              onClick={() => void confirmDelete()}
            >
              {t("action.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(passwordTarget())}
        onOpenChange={(open: boolean) => {
          if (!open) setPasswordTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("servers.passwordTitle", {
                name: passwordTarget()?.name ?? "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("servers.passwordDesc", {
                username: passwordTarget()?.username ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4" onSubmit={(event) => void submitPassword(event)}>
            <div class="space-y-1.5">
              <Label for="connect-password">{t("field.password")}</Label>
              <Input
                id="connect-password"
                type="password"
                autofocus
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
                placeholder={t("field.passwordPlaceholder")}
                autocomplete="current-password"
              />
            </div>
            <CheckboxField
              checked={remember()}
              onChange={setRemember}
              label={t("servers.remember")}
              description={t("field.savePasswordHint")}
            />
            <Show when={error()}>
              <FieldError>{error()}</FieldError>
            </Show>
            <DialogFooter class="mt-0">
              <Button variant="ghost" onClick={() => setPasswordTarget(null)}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={busy()}>
                <Show when={busy()}>
                  <LoaderCircle class="size-4 animate-spin" />
                </Show>
                {t("action.connect")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
