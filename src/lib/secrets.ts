import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./platform";

/**
 * Passwords are kept in the OS credential store (Windows Credential Manager,
 * macOS Keychain, libsecret on Linux). The browser dev build falls back to
 * localStorage so the UI can be tested without Tauri.
 */
const SERVICE = "com.stepz.stepunder";

const localKey = (account: string) => `stepunder:secret:${account}`;

export function secretAccount(serverId: string) {
  return `server-${serverId}`;
}

export async function saveSecret(account: string, secret: string): Promise<void> {
  if (isTauri) {
    await invoke("save_secret", { service: SERVICE, account, secret });
    return;
  }
  localStorage.setItem(localKey(account), secret);
}

export async function getSecret(account: string): Promise<string | null> {
  if (isTauri) {
    try {
      const value = await invoke<string | null>("get_secret", {
        service: SERVICE,
        account,
      });
      return value ?? null;
    } catch (error) {
      console.error("Failed to read secret from keychain", error);
      return null;
    }
  }
  return localStorage.getItem(localKey(account));
}

export async function deleteSecret(account: string): Promise<void> {
  if (isTauri) {
    try {
      await invoke("delete_secret", { service: SERVICE, account });
    } catch (error) {
      console.error("Failed to delete secret from keychain", error);
    }
    return;
  }
  localStorage.removeItem(localKey(account));
}
