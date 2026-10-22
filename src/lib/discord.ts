/**
 * Discord Rich Presence bridge (see src-tauri/src/discord.rs).
 *
 * Only works in the desktop app with Discord running; everywhere else the
 * helpers resolve quietly so callers do not have to care.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./platform";

export interface DiscordPresencePayload {
  details: string;
  state: string;
  largeImage?: string | null;
  largeText?: string | null;
  /** Unix milliseconds, used for Discord's progress bar. */
  start?: number | null;
  end?: number | null;
  paused?: boolean;
}

/** Push the current activity. Returns `false` when Discord is unreachable. */
export async function updateDiscordPresence(
  payload: DiscordPresencePayload,
): Promise<boolean> {
  if (!isTauri) return false;
  try {
    return await invoke<boolean>("discord_update_presence", { payload });
  } catch (error) {
    console.warn("Discord presence update failed", error);
    return false;
  }
}

export async function clearDiscordPresence(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("discord_clear_presence");
  } catch (error) {
    console.warn("Discord presence clear failed", error);
  }
}
