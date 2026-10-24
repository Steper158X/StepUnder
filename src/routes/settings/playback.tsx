import {
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { RefreshCw } from "lucide-solid";
import { t } from "~/i18n";
import {
  DEFAULT_MPV_AUDIO_DEVICE,
  audioDeviceId,
  audioPlayer,
  discordPresence,
  maxBitRate,
  mpvAudioDevice,
  scrobble,
  setAudioDeviceId,
  setAudioPlayer,
  setDiscordPresence,
  setMaxBitRate,
  setMpvAudioDevice,
  setScrobble,
  setStreamFormat,
  streamFormat,
  type AudioPlayer,
  type StreamFormat,
} from "~/state/settings";
import {
  DEFAULT_AUDIO_DEVICE,
  hasHiddenDeviceLabels,
  listAudioOutputs,
  supportsAudioOutputSelection,
  unlockAudioOutputs,
  type AudioOutputDevice,
} from "~/lib/audio-output";
import {
  mpvAudioDevices,
  mpvEnsure,
  mpvStatus,
  type MpvAudioDevice,
  type MpvStatus,
} from "~/lib/mpv";
import { isTauri } from "~/lib/platform";
import { toast } from "~/components/toaster";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";
import { Row, SettingsSubPage } from "./shared";

const bitrateOptions = [0, 320, 256, 192, 128];

const formatOptions: StreamFormat[] = ["raw", "mp3", "aac", "opus", "flac"];

/** Speakers only need to be unlocked once per app session. */
let unlockedThisSession = false;

export default function PlaybackSettingsPage() {
  const outputSupported = supportsAudioOutputSelection();
  const [outputs, setOutputs] = createSignal<AudioOutputDevice[]>([]);
  const [refreshingOutputs, setRefreshingOutputs] = createSignal(false);
  const [unlockingOutputs, setUnlockingOutputs] = createSignal(false);
  const [labelsHidden, setLabelsHidden] = createSignal(false);
  const [mpvInfo, setMpvInfo] = createSignal<MpvStatus | null>(null);
  const [checkingPlayer, setCheckingPlayer] = createSignal(false);
  const [mpvDevices, setMpvDevices] = createSignal<MpvAudioDevice[]>([]);
  const [refreshingMpvDevices, setRefreshingMpvDevices] = createSignal(false);

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

  const mpvDeviceDescription = () => {
    if (refreshingMpvDevices() && mpvDevices().length === 0) {
      return t("settings.audioDeviceLoading");
    }
    return t("settings.audioDeviceMpvHint");
  };

  const mpvDeviceOptions = () => {
    const list = mpvDevices().map((device) => ({
      value: device.id,
      label:
        device.id === DEFAULT_MPV_AUDIO_DEVICE
          ? t("settings.audioDeviceDefault")
          : device.label.trim() || device.id,
    }));
    if (!list.some((option) => option.value === DEFAULT_MPV_AUDIO_DEVICE)) {
      list.unshift({
        value: DEFAULT_MPV_AUDIO_DEVICE,
        label: t("settings.audioDeviceDefault"),
      });
    }
    const selected = mpvAudioDevice();
    if (!list.some((option) => option.value === selected)) {
      list.push({
        value: selected,
        label: t("settings.audioDeviceUnavailable"),
      });
    }
    return list;
  };

  const deviceOptions = () => {
    if (audioPlayer() === "mpv") return mpvDeviceOptions();
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

  async function refreshMpvDevices() {
    if (audioPlayer() !== "mpv" || refreshingMpvDevices()) return;
    setRefreshingMpvDevices(true);
    try {
      setMpvDevices(await mpvAudioDevices());
    } finally {
      setRefreshingMpvDevices(false);
    }
  }

  // mpv is the source of truth for its own outputs, so (re)read the list when
  // the engine is selected (including after settings were restored).
  createEffect(
    on(audioPlayer, (player) => {
      if (player === "mpv") void refreshMpvDevices();
    }),
  );

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

  return (
    <SettingsSubPage title={t("settings.playback")}>
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
                { value: "web", label: t("settings.audioPlayerWeb") },
                { value: "mpv", label: mpvLabel() },
              ]}
              onChange={(value) => void changeAudioPlayer(value as AudioPlayer)}
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
          audioPlayer() === "mpv" ? mpvDeviceDescription() : deviceDescription()
        }
      >
        <div class="flex items-center gap-2">
          <div class="w-44">
            <Select
              aria-label={t("settings.audioDevice")}
              value={audioPlayer() === "mpv" ? mpvAudioDevice() : audioDeviceId()}
              disabled={audioPlayer() !== "mpv" && !outputSupported}
              options={deviceOptions()}
              onChange={(value) => {
                if (audioPlayer() === "mpv") setMpvAudioDevice(value);
                else setAudioDeviceId(value);
              }}
            />
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            title={t("settings.audioDeviceRefresh")}
            aria-label={t("settings.audioDeviceRefresh")}
            disabled={
              audioPlayer() === "mpv"
                ? refreshingMpvDevices()
                : !outputSupported || refreshingOutputs()
            }
            onClick={() =>
              void (audioPlayer() === "mpv"
                ? refreshMpvDevices()
                : refreshOutputs())
            }
          >
            <RefreshCw
              class={cn(
                "size-3.5",
                (audioPlayer() === "mpv"
                  ? refreshingMpvDevices()
                  : refreshingOutputs()) && "animate-spin",
              )}
            />
          </Button>
        </div>
      </Row>

      <Row label={t("settings.scrobble")} description={t("settings.scrobbleHint")}>
        <Switch
          checked={scrobble()}
          onChange={setScrobble}
          label={t("settings.scrobble")}
        />
      </Row>

      <Show when={isTauri}>
        <Row
          label={t("settings.discordPresence")}
          description={t("settings.discordPresenceHint")}
        >
          <Switch
            checked={discordPresence()}
            onChange={setDiscordPresence}
            label={t("settings.discordPresence")}
          />
        </Row>
      </Show>

      <Row label={t("settings.bitrate")} description={t("settings.bitrateHint")}>
        <div class="w-44">
          <Select
            aria-label={t("settings.bitrate")}
            value={String(maxBitRate())}
            options={bitrateOptions.map((value) => ({
              value: String(value),
              label:
                value === 0 ? t("settings.bitrateOriginal") : `${value} kbps`,
            }))}
            onChange={(value) => setMaxBitRate(Number(value))}
          />
        </div>
      </Row>

      <Row label={t("settings.format")} description={t("settings.formatHint")}>
        <div class="w-44">
          <Select
            aria-label={t("settings.format")}
            value={streamFormat()}
            options={formatOptions.map((value) => ({
              value,
              label:
                value === "raw" ? t("settings.formatRaw") : value.toUpperCase(),
            }))}
            onChange={(value) => setStreamFormat(value as StreamFormat)}
          />
        </div>
      </Row>
    </SettingsSubPage>
  );
}
