/**
 * Helpers for picking the speaker/headphone the webview plays through.
 *
 * Chromium (and therefore WebView2) exposes output routing through
 * `HTMLMediaElement.setSinkId()` plus `enumerateDevices()`. Only audio-output
 * devices are used; the microphone is never requested or opened.
 */

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

/** Sentinel used instead of the empty string so the value survives storage. */
export const DEFAULT_AUDIO_DEVICE = "system-default";

function looksLikePlaceholder(label: string): boolean {
  return /^(audio output|output|speaker|speakers|communications)\s*\d*$/i.test(
    label,
  );
}

export function supportsAudioOutputSelection(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype &&
    Boolean(navigator.mediaDevices?.enumerateDevices)
  );
}

export async function listAudioOutputs(): Promise<AudioOutputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audiooutput")
      // "default" is Chromium's alias for the current system default, which the
      // settings UI already offers as its own sentinel. The empty id is the
      // placeholder Chromium returns while device access has not been granted.
      .filter(
        (device) => device.deviceId !== "default" && device.deviceId !== "",
      )
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label,
      }));
  } catch (error) {
    console.warn("Failed to list audio outputs", error);
    return [];
  }
}

/**
 * Chromium only reveals the full list of speakers after `getUserMedia` has
 * succeeded once. Open a throwaway audio stream and stop it immediately; the
 * stream is never read, stored or sent anywhere. Microphones are still filtered
 * out of every device list we show.
 */
export async function unlockAudioOutputs(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch (error) {
    console.warn("Audio device access was denied", error);
    return false;
  }
}

/** True when the platform gave us placeholders instead of real device names. */
export function hasHiddenDeviceLabels(devices: AudioOutputDevice[]): boolean {
  return (
    devices.length > 0 &&
    devices.every(
      (device) => !device.label.trim() || looksLikePlaceholder(device.label),
    )
  );
}

/** Route `audio` to the given output. Returns false when unsupported/failed. */
export async function applyAudioOutput(
  audio: HTMLAudioElement,
  deviceId: string,
): Promise<boolean> {
  if (!supportsAudioOutputSelection()) return false;
  try {
    await audio.setSinkId(deviceId === DEFAULT_AUDIO_DEVICE ? "" : deviceId);
    return true;
  } catch (error) {
    console.warn("Failed to switch audio output", error);
    return false;
  }
}
