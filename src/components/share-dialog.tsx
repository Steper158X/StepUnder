import { For, Show, createEffect, createSignal, on } from "solid-js";
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Share2,
  X,
} from "lucide-solid";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Song } from "~/lib/types";
import { t, type MessageKey } from "~/i18n";
import { isTauri } from "~/lib/platform";
import { subsonicErrorKey } from "~/lib/subsonic";
import { cn, copyText } from "~/lib/utils";
import { useServers } from "~/state/servers";
import { Cover, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { FieldError, FieldHint, Input, Label } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

const DAY = 24 * 60 * 60 * 1000;

const PRESETS: Array<{ label: MessageKey; ms: number | null }> = [
  { label: "share.preset.default", ms: null },
  { label: "share.preset.day", ms: DAY },
  { label: "share.preset.week", ms: 7 * DAY },
  { label: "share.preset.month", ms: 30 * DAY },
  { label: "share.preset.year", ms: 365 * DAY },
];

/** `Date` → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function ShareDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: Song;
}) {
  const servers = useServers();
  const [expires, setExpires] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [downloadable, setDownloadable] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [url, setUrl] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  let expiresInput: HTMLInputElement | undefined;

  function openPicker() {
    expiresInput?.focus();
    try {
      expiresInput?.showPicker();
    } catch {
      // Older WebViews lack showPicker(); the focused input still takes typing.
    }
  }

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setExpires("");
        setDescription(
          [props.song.title, props.song.artist].filter(Boolean).join(" - "),
        );
        setDownloadable(false);
        setBusy(false);
        setError(null);
        setUrl(null);
        setCopied(false);
      },
    ),
  );

  async function copy(link: string) {
    setCopied(await copyText(link));
  }

  async function submit(event: Event) {
    event.preventDefault();
    const client = servers.client();
    if (!client || busy()) return;
    const expiresAt = expires() ? new Date(expires()) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      setError(t("share.expirationPast"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const link = await client.createShare([props.song.id], {
        description: description().trim(),
        expires: expiresAt,
        downloadable: downloadable(),
      });
      setUrl(link);
      await copy(link);
    } catch (failure) {
      setError(t(subsonicErrorKey(failure) as MessageKey));
    } finally {
      setBusy(false);
    }
  }

  function open(link: string) {
    if (isTauri) void openUrl(link);
    else window.open(link, "_blank", "noopener");
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !busy() && props.onOpenChange(open)}
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
        </DialogHeader>

        <div class="mb-4 flex items-center gap-3">
          <Cover
            coverArtId={props.song.coverArt}
            size={96}
            alt={props.song.album ?? props.song.title}
            class="size-12 shrink-0 rounded-md"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{props.song.title}</p>
            <p class="truncate text-xs text-muted-foreground">
              {props.song.artist ?? t("common.unknownArtist")}
            </p>
          </div>
        </div>

        <Show
          when={url()}
          fallback={
            <form class="flex flex-col gap-4" onSubmit={submit}>
              <div class="space-y-1.5">
                <Label for="share-expires">{t("share.expiration")}</Label>
                <FieldHint>{t("share.expirationHint")}</FieldHint>
                <div class="relative">
                  {/* The native picker icon sits right after the text, so hide
                      it and draw our own at the far right instead. */}
                  <Input
                    ref={expiresInput}
                    id="share-expires"
                    type="datetime-local"
                    value={expires()}
                    min={toLocalInput(new Date())}
                    onInput={(event) => setExpires(event.currentTarget.value)}
                    disabled={busy()}
                    class={cn(
                      "[color-scheme:light_dark] [&::-webkit-calendar-picker-indicator]:hidden",
                      expires() ? "pr-16" : "pr-9",
                    )}
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    onClick={openPicker}
                    disabled={busy()}
                    aria-label={t("share.expiration")}
                  >
                    <CalendarDays class="size-4" />
                  </button>
                  <Show when={expires()}>
                    <button
                      type="button"
                      class="absolute right-9 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setExpires("")}
                      aria-label={t("action.clear")}
                    >
                      <X class="size-3.5" />
                    </button>
                  </Show>
                </div>
                <div class="flex flex-wrap gap-1.5 pt-1">
                  <For each={PRESETS}>
                    {(preset) => {
                      const value = () =>
                        preset.ms === null
                          ? ""
                          : toLocalInput(new Date(Date.now() + preset.ms));
                      return (
                        <button
                          type="button"
                          class={cn(
                            "rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-50",
                            preset.ms === null &&
                              !expires() &&
                              "bg-primary/15 text-primary",
                          )}
                          disabled={busy()}
                          onClick={() => {
                            setExpires(value());
                            setError(null);
                          }}
                        >
                          {t(preset.label)}
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>

              <div class="space-y-1.5">
                <Label for="share-description">{t("share.description")}</Label>
                <textarea
                  id="share-description"
                  value={description()}
                  onInput={(event) => setDescription(event.currentTarget.value)}
                  rows={3}
                  maxLength={1000}
                  disabled={busy()}
                  class="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium">{t("share.downloadable")}</p>
                  <FieldHint>{t("share.downloadableHint")}</FieldHint>
                </div>
                <Switch
                  checked={downloadable()}
                  onChange={setDownloadable}
                  label={t("share.downloadable")}
                  disabled={busy()}
                />
              </div>

              <Show when={error()}>
                <FieldError>{error()}</FieldError>
              </Show>

              <DialogFooter class="mt-1">
                <Button
                  variant="ghost"
                  onClick={() => props.onOpenChange(false)}
                  disabled={busy()}
                >
                  {t("action.cancel")}
                </Button>
                <Button type="submit" disabled={busy()}>
                  <Show
                    when={busy()}
                    fallback={<Share2 class="size-4" />}
                  >
                    <Spinner class="size-4 border-primary-foreground/30 border-t-primary-foreground" />
                  </Show>
                  {busy() ? t("share.creating") : t("action.share")}
                </Button>
              </DialogFooter>
            </form>
          }
        >
          {(link) => (
            <div class="flex flex-col gap-3">
              <div class="space-y-1.5">
                <Label for="share-link">{t("share.link")}</Label>
                <div class="flex gap-2">
                  <Input
                    id="share-link"
                    readOnly
                    value={link()}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button variant="outline" onClick={() => void copy(link())}>
                    <Show when={copied()} fallback={<Copy class="size-4" />}>
                      <Check class="size-4" />
                    </Show>
                    {t(copied() ? "share.copied" : "share.copy")}
                  </Button>
                </div>
              </div>
              <DialogFooter class="mt-2">
                <Button variant="ghost" onClick={() => open(link())}>
                  <ExternalLink class="size-4" />
                  {t("share.open")}
                </Button>
                <Button onClick={() => props.onOpenChange(false)}>
                  {t("action.close")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </Show>
      </DialogContent>
    </Dialog>
  );
}
