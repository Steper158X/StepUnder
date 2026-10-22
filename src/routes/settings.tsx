import { useNavigate } from "@solidjs/router";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  LoaderCircle,
  LogIn,
  Pencil,
  RefreshCw,
  Server,
} from "lucide-solid";
import {
  locale,
  setLocale,
  t,
  type MessageKey,
  type Locale,
} from "~/i18n";
import {
  audioDeviceId,
  audioPlayer,
  font,
  maxBitRate,
  scrobble,
  setAudioDeviceId,
  setAudioPlayer,
  setFont,
  setMaxBitRate,
  setScrobble,
  setStreamFormat,
  setTheme,
  streamFormat,
  theme,
  type AudioPlayer,
  type Font,
  type StreamFormat,
  type Theme,
} from "~/state/settings";
import {
  DEFAULT_AUDIO_DEVICE,
  hasHiddenDeviceLabels,
  listAudioOutputs,
  supportsAudioOutputSelection,
  unlockAudioOutputs,
  type AudioOutputDevice,
} from "~/lib/audio-output";
import { useServers } from "~/state/servers";
import { subsonicErrorKey } from "~/lib/subsonic";
import { mpvEnsure, mpvStatus, type MpvStatus } from "~/lib/mpv";
import { isTauri } from "~/lib/platform";
import { toast } from "~/components/toaster";
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

const fontOptions: Array<{ value: Font; key: MessageKey }> = [
  { value: "system", key: "settings.font.system" },
  { value: "sarabun", key: "settings.font.sarabun" },
];

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

/** Speakers only need to be unlocked once per app session. */
let unlockedThisSession = false;

export default function SettingsPage() {
  const servers = useServers();
  const navigate = useNavigate();
  const [switchingId, setSwitchingId] = createSignal<string | null>(null);
  const outputSupported = supportsAudioOutputSelection();
  const [outputs, setOutputs] = createSignal<AudioOutputDevice[]>([]);
  const [refreshingOutputs, setRefreshingOutputs] = createSignal(false);
  const [unlockingOutputs, setUnlockingOutputs] = createSignal(false);
  const [labelsHidden, setLabelsHidden] = createSignal(false);
  const [mpvInfo, setMpvInfo] = createSignal<MpvStatus | null>(null);
  const [checkingPlayer, setCheckingPlayer] = createSignal(false);

  const mpvLabel = () => {
    const version = mpvInfo()?.version;
    return version ? `mpv ${version}` : t("settings.audioPlayerMpv");
  };

  const deviceDescription = () => {
    if (!outputSupported) return t("settings.audioDeviceUnsupported");
    if (unlockingOutputs()) return t("settings.audioDeviceLoading");
    if (outputs().length === 0) return t("settings.audioDeviceLockedHint");
    if (labelsHidden()) return t("settings.audioDeviceLabelsHint");
    return t("settings.audioDeviceHint");
  };

  const deviceOptions = () => {
    const list = outputs().map((device, index) => ({
      value: device.deviceId,
      label:
        device.label.trim() ||
        t("settings.audioDeviceFallback", { index: index + 1 }),
    }));
    const selected = audioDeviceId();
    if (
      selected !== DEFAULT_AUDIO_DEVICE &&
      !list.some((option) => option.value === selected)
    ) {
      list.push({
        value: selected,
        label: t("settings.audioDeviceUnavailable"),
      });
    }
    return [
      { value: DEFAULT_AUDIO_DEVICE, label: t("settings.audioDeviceDefault") },
      ...list,
    ];
  };

  async function refreshOutputs() {
    if (!outputSupported || refreshingOutputs()) return;
    setRefreshingOutputs(true);
    try {
      const devices = await listAudioOutputs();
      setOutputs(devices);
      setLabelsHidden(hasHiddenDeviceLabels(devices));
    } finally {
      setRefreshingOutputs(false);
    }
  }

  async function unlockOutputs() {
    if (!outputSupported || unlockingOutputs()) return;
    setUnlockingOutputs(true);
    try {
      if (!(await unlockAudioOutputs())) return;
      const devices = await listAudioOutputs();
      setOutputs(devices);
      setLabelsHidden(hasHiddenDeviceLabels(devices));
    } finally {
      setUnlockingOutputs(false);
    }
  }

  onMount(() => {
    if (!isTauri) return;
    void mpvStatus().then(setMpvInfo);
  });

  onMount(() => {
    if (!outputSupported) return;

    void (async () => {
      await refreshOutputs();
      // Speakers are hidden until Chromium has opened an audio device once in
      // this session, so unlock automatically on load.
      if (!unlockedThisSession && (outputs().length === 0 || labelsHidden())) {
        unlockedThisSession = true;
        await unlockOutputs();
      }
    })();

    const media = navigator.mediaDevices;
    const handleDeviceChange = () => void refreshOutputs();
    media?.addEventListener("devicechange", handleDeviceChange);
    onCleanup(() => {
      media?.removeEventListener("devicechange", handleDeviceChange);
    });
  });

  async function changeAudioPlayer(value: AudioPlayer) {
    if (value === "web") {
      setAudioPlayer("web");
      return;
    }
    if (checkingPlayer()) return;
    if (!isTauri) {
      toast(t("settings.mpvMissingTitle"), t("settings.mpvMissing"), "error");
      return;
    }
    setCheckingPlayer(true);
    try {
      const status = await mpvEnsure();
      setMpvInfo(status);
      if (!status.available) {
        toast(
          t("settings.mpvMissingTitle"),
          status.error ?? t("settings.mpvMissing"),
          "error",
        );
        return;
      }
      setAudioPlayer("mpv");
    } finally {
      setCheckingPlayer(false);
    }
  }

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

            <Row
              label={t("settings.font")}
              description={t("settings.fontHint")}
            >
              <div class="w-44">
                <Select
                  aria-label={t("settings.font")}
                  value={font()}
                  options={fontOptions.map((option) => ({
                    value: option.value,
                    label: t(option.key),
                  }))}
                  onChange={(value) => setFont(value as Font)}
                />
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
              label={t("settings.audioPlayer")}
              description={t("settings.audioPlayerHint")}
            >
              <div class="flex flex-col items-end gap-1">
                <div class="w-44">
                  <Select
                    aria-label={t("settings.audioPlayer")}
                    value={audioPlayer()}
                    options={[
                      {
                        value: "web",
                        label: t("settings.audioPlayerWeb"),
                      },
                      { value: "mpv", label: mpvLabel() },
                    ]}
                    onChange={(value) =>
                      void changeAudioPlayer(value as AudioPlayer)
                    }
                  />
                </div>
                <Show when={checkingPlayer()}>
                  <p class="max-w-[18rem] text-right text-xs text-muted-foreground">
                    {t("settings.mpvChecking")}
                  </p>
                </Show>
              </div>
            </Row>

            <Row
              label={t("settings.audioDevice")}
              description={
                audioPlayer() === "mpv"
                  ? t("settings.audioDeviceMpvHint")
                  : deviceDescription()
              }
            >
              <div class="flex items-center gap-2">
                <div class="w-44">
                  <Select
                    aria-label={t("settings.audioDevice")}
                    value={audioDeviceId()}
                    disabled={!outputSupported || audioPlayer() === "mpv"}
                    options={deviceOptions()}
                    onChange={setAudioDeviceId}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  title={t("settings.audioDeviceRefresh")}
                  aria-label={t("settings.audioDeviceRefresh")}
                  disabled={
                    !outputSupported ||
                    refreshingOutputs() ||
                    audioPlayer() === "mpv"
                  }
                  onClick={() => void refreshOutputs()}
                >
                  <RefreshCw
                    class={cn(
                      "size-3.5",
                      refreshingOutputs() && "animate-spin",
                    )}
                  />
                </Button>
              </div>
            </Row>

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
                      <Show
                        when={
                          server.id === servers.activeId() && servers.client()
                        }
                        fallback={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={switchingId() !== null}
                            onClick={() =>
                              void switchServer(server.id, server.name)
                            }
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
