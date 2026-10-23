import { Show } from "solid-js";
import { Download, LoaderCircle } from "lucide-solid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import {
  available,
  dismissPrompt,
  error,
  installUpdate,
  progressPercent,
  promptOpen,
  status,
} from "~/lib/updater";

/** Modal shown when the startup/manual check finds a newer release. */
export function UpdatePrompt() {
  const busy = () =>
    status() === "downloading" || status() === "installing";
  const percentLabel = () => {
    const value = progressPercent();
    return value === null ? null : `${value}%`;
  };

  const openChange = (open: boolean) => {
    if (!open && !busy()) dismissPrompt();
  };

  return (
    <Dialog open={promptOpen()} onOpenChange={openChange}>
      <DialogContent class="max-w-lg" showClose={!busy()}>
        <DialogHeader>
          <DialogTitle>{t("update.title")}</DialogTitle>
          <DialogDescription>
            {t("update.description", {
              version: available()?.version ?? "",
              current: available()?.currentVersion ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <Show when={available()?.notes?.trim()}>
          <div class="mb-1">
            <p class="mb-1.5 text-xs font-medium text-muted-foreground">
              {t("update.notes")}
            </p>
            <div class="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/70 bg-secondary/40 p-3 text-xs leading-relaxed">
              {available()?.notes}
            </div>
          </div>
        </Show>

        <Show when={busy()}>
          <div class="mt-2">
            <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                class={cn(
                  "h-full rounded-full bg-primary transition-[width] duration-200",
                  percentLabel() === null && "animate-pulse",
                )}
                style={{ width: `${progressPercent() ?? 100}%` }}
              />
            </div>
            <p class="mt-1.5 text-xs text-muted-foreground">
              {status() === "installing"
                ? t("update.installing")
                : percentLabel()
                  ? t("update.downloading", { percent: percentLabel()! })
                  : t("update.downloading", { percent: "" })}
            </p>
          </div>
        </Show>

        <Show when={status() === "error" && error()}>
          <p class="mt-2 text-xs text-destructive">
            {t("update.error")} {error()}
          </p>
        </Show>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy()}
            onClick={dismissPrompt}
          >
            {t("update.later")}
          </Button>
          <Button disabled={busy()} onClick={() => void installUpdate()}>
            <Show
              when={busy()}
              fallback={<Download class="size-4" />}
            >
              <LoaderCircle class="size-4 animate-spin" />
            </Show>
            {t("update.install")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
