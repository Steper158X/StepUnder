import { useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Pencil, Server } from "lucide-solid";
import {
  locale,
  setLocale,
  t,
  type MessageKey,
  type Locale,
} from "~/i18n";
import {
  maxBitRate,
  scrobble,
  setMaxBitRate,
  setScrobble,
  setStreamFormat,
  setTheme,
  streamFormat,
  theme,
  type StreamFormat,
  type Theme,
} from "~/state/settings";
import { useServers } from "~/state/servers";
import { Page, PageHeader } from "~/components/layout-bits";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge, Select } from "~/components/ui/select";
import { CheckboxField } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";

const themeOptions: Array<{ value: Theme; key: MessageKey }> = [
  { value: "dark", key: "settings.theme.dark" },
  { value: "light", key: "settings.theme.light" },
  { value: "system", key: "settings.theme.system" },
];

const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];

const bitrateOptions = [0, 320, 256, 192, 128];

const formatOptions: StreamFormat[] = ["raw", "mp3", "aac", "opus", "flac"];

function Row(props: {
  label: string;
  description?: string;
  children: import("solid-js").JSX.Element;
  class?: string;
}) {
  return (
    <div
      class={cn(
        "flex flex-wrap items-center justify-between gap-3 py-3.5",
        props.class,
      )}
    >
      <div class="min-w-0">
        <p class="text-sm font-medium">{props.label}</p>
        <Show when={props.description}>
          <p class="mt-0.5 max-w-md text-xs text-muted-foreground">
            {props.description}
          </p>
        </Show>
      </div>
      <div class="flex items-center gap-2">{props.children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const servers = useServers();
  const navigate = useNavigate();

  return (
    <Page class="max-w-3xl">
      <PageHeader title={t("settings.title")} />

      <div class="space-y-5">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle>{t("settings.appearance")}</CardTitle>
          </CardHeader>
          <CardContent class="divide-y divide-border/60 pt-0">
            <Row label={t("settings.theme")}>
              <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
                <For each={themeOptions}>
                  {(option) => (
                    <button
                      type="button"
                      onClick={() => setTheme(option.value)}
                      class={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        theme() === option.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(option.key)}
                    </button>
                  )}
                </For>
              </div>
            </Row>

            <Row label={t("settings.language")}>
              <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
                <For each={localeOptions}>
                  {(option) => (
                    <button
                      type="button"
                      onClick={() => setLocale(option.value)}
                      class={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        locale() === option.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  )}
                </For>
              </div>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle>{t("settings.playback")}</CardTitle>
          </CardHeader>
          <CardContent class="divide-y divide-border/60 pt-0">
            <Row
              label={t("settings.scrobble")}
              description={t("settings.scrobbleHint")}
            >
              <CheckboxField
                checked={scrobble()}
                onChange={setScrobble}
                label=""
              />
            </Row>

            <Row
              label={t("settings.bitrate")}
              description={t("settings.bitrateHint")}
            >
              <div class="w-44">
                <Select
                  aria-label={t("settings.bitrate")}
                  value={String(maxBitRate())}
                  options={bitrateOptions.map((value) => ({
                    value: String(value),
                    label:
                      value === 0
                        ? t("settings.bitrateOriginal")
                        : `${value} kbps`,
                  }))}
                  onChange={(value) => setMaxBitRate(Number(value))}
                />
              </div>
            </Row>

            <Row
              label={t("settings.format")}
              description={t("settings.formatHint")}
            >
              <div class="w-44">
                <Select
                  aria-label={t("settings.format")}
                  value={streamFormat()}
                  options={formatOptions.map((value) => ({
                    value,
                    label:
                      value === "raw"
                        ? t("settings.formatRaw")
                        : value.toUpperCase(),
                  }))}
                  onChange={(value) =>
                    setStreamFormat(value as StreamFormat)
                  }
                />
              </div>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex-row items-center justify-between pb-2">
            <CardTitle>{t("settings.servers")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/servers")}
            >
              <Pencil class="size-3.5" />
              {t("servers.manage")}
            </Button>
          </CardHeader>
          <CardContent class="pt-0">
            <Show
              when={servers.servers().length > 0}
              fallback={
                <p class="py-4 text-sm text-muted-foreground">
                  {t("servers.empty")}
                </p>
              }
            >
              <div class="divide-y divide-border/60">
                <For each={servers.servers()}>
                  {(server) => (
                    <div class="flex items-center gap-3 py-3">
                      <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                        <Server class="size-4" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium">
                          {server.name}
                        </p>
                        <p class="truncate text-xs text-muted-foreground">
                          {server.url}
                        </p>
                      </div>
                      <Show when={server.id === servers.activeId()}>
                        <Badge>{t("servers.active")}</Badge>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              <p class="pt-3 text-xs text-muted-foreground">
                {t("settings.keychainHint")}
              </p>
            </Show>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-2">
            <CardTitle>{t("settings.about")}</CardTitle>
          </CardHeader>
          <CardContent class="pt-0">
            <p class="text-sm text-muted-foreground">
              {t("settings.aboutHint")}
            </p>
            <p class="mt-3 text-xs text-muted-foreground">
              {t("settings.version")}: 0.1.0
            </p>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
