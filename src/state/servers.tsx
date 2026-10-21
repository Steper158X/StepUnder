import {
  createContext,
  createMemo,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import type { ServerConfig, ServerInput } from "~/lib/types";
import {
  SubsonicClient,
  subsonicErrorKey,
} from "~/lib/subsonic";
import { readSetting, writeSetting } from "~/lib/storage";
import {
  deleteSecret,
  getSecret,
  saveSecret,
  secretAccount,
} from "~/lib/secrets";
import { normalizeServerUrl as normalizeUrl } from "~/lib/subsonic";

export type ConnectResult = "connected" | "need-password";

export interface ServersContextValue {
  servers: Accessor<ServerConfig[]>;
  activeId: Accessor<string | null>;
  activeServer: Accessor<ServerConfig | null>;
  client: Accessor<SubsonicClient | null>;
  passwords: Accessor<Record<string, string>>;
  ready: Accessor<boolean>;
  connectingId: Accessor<string | null>;
  startupError: Accessor<string | null>;
  clearStartupError: () => void;
  addServer: (input: ServerInput) => Promise<ServerConfig>;
  updateServer: (id: string, input: ServerInput) => Promise<ServerConfig>;
  removeServer: (id: string) => Promise<void>;
  connect: (id: string) => Promise<ConnectResult>;
  connectWithPassword: (
    id: string,
    password: string,
    remember: boolean,
  ) => Promise<void>;
  disconnect: () => Promise<void>;
}

const ServersContext = createContext<ServersContextValue>();

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `srv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildClient(server: ServerConfig, password: string) {
  return new SubsonicClient({
    url: server.url,
    username: server.username,
    password,
  });
}

function defaultName(name: string, url: string, username: string): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  try {
    return new URL(url).host;
  } catch {
    return username;
  }
}

function isServerConfig(value: unknown): value is ServerConfig {
  if (!value || typeof value !== "object") return false;
  const server = value as ServerConfig;
  return (
    typeof server.id === "string" &&
    typeof server.name === "string" &&
    typeof server.url === "string" &&
    typeof server.username === "string"
  );
}

export function ServersProvider(props: { children: JSX.Element }) {
  const [servers, setServers] = createSignal<ServerConfig[]>([]);
  const [passwords, setPasswords] = createSignal<Record<string, string>>({});
  const [activeId, setActiveId] = createSignal<string | null>(null);
  const [client, setClient] = createSignal<SubsonicClient | null>(null);
  const [ready, setReady] = createSignal(false);
  const [connectingId, setConnectingId] = createSignal<string | null>(null);
  const [startupError, setStartupError] = createSignal<string | null>(null);

  const activeServer = createMemo(
    () => servers().find((server) => server.id === activeId()) ?? null,
  );

  async function persistServers(next: ServerConfig[]) {
    setServers(next);
    await writeSetting("servers", next);
  }

  function setPasswordFor(id: string, value: string | null) {
    setPasswords((current) => {
      const next = { ...current };
      if (value === null) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  async function activate(id: string, nextClient: SubsonicClient) {
    setClient(nextClient);
    setActiveId(id);
    setStartupError(null);
    await writeSetting("activeServerId", id);
  }

  async function addServer(input: ServerInput): Promise<ServerConfig> {
    const url = normalizeUrl(input.url);
    const candidate: ServerConfig = {
      id: createId(),
      name: defaultName(input.name, url, input.username),
      url,
      username: input.username.trim(),
      savePassword: input.savePassword,
      createdAt: Date.now(),
    };

    const probe = buildClient(candidate, input.password);
    await probe.ping();

    setPasswordFor(candidate.id, input.password);
    if (candidate.savePassword) {
      await saveSecret(secretAccount(candidate.id), input.password);
    } else {
      await deleteSecret(secretAccount(candidate.id));
    }

    await persistServers([...servers(), candidate]);
    await activate(candidate.id, probe);
    return candidate;
  }

  async function updateServer(
    id: string,
    input: ServerInput,
  ): Promise<ServerConfig> {
    const existing = servers().find((server) => server.id === id);
    if (!existing) throw new Error("unknown-server");

    const url = normalizeUrl(input.url);
    const next: ServerConfig = {
      ...existing,
      name: defaultName(input.name, url, input.username),
      url,
      username: input.username.trim(),
      savePassword: input.savePassword,
    };

    const probe = buildClient(next, input.password);
    await probe.ping();

    await persistServers(
      servers().map((server) => (server.id === id ? next : server)),
    );
    setPasswordFor(id, input.password);
    if (next.savePassword) {
      await saveSecret(secretAccount(id), input.password);
    } else {
      await deleteSecret(secretAccount(id));
    }
    if (activeId() === id) {
      await activate(id, probe);
    }
    return next;
  }

  async function removeServer(id: string): Promise<void> {
    await deleteSecret(secretAccount(id));
    const next = servers().filter((server) => server.id !== id);
    await persistServers(next);
    setPasswordFor(id, null);
    if (activeId() === id) {
      setClient(null);
      setActiveId(null);
      await writeSetting("activeServerId", null);
    }
  }

  async function connect(id: string): Promise<ConnectResult> {
    const server = servers().find((item) => item.id === id);
    if (!server) return "need-password";
    const password = passwords()[id];
    if (!password) {
      setActiveId(id);
      return "need-password";
    }

    setConnectingId(id);
    setStartupError(null);
    try {
      const probe = buildClient(server, password);
      await probe.ping();
      await activate(id, probe);
      return "connected";
    } catch (error) {
      console.error("Failed to connect", error);
      setStartupError(subsonicErrorKey(error));
      throw error;
    } finally {
      setConnectingId(null);
    }
  }

  async function connectWithPassword(
    id: string,
    password: string,
    remember: boolean,
  ): Promise<void> {
    const server = servers().find((item) => item.id === id);
    if (!server) throw new Error("unknown-server");

    setConnectingId(id);
    setStartupError(null);
    try {
      const probe = buildClient(server, password);
      await probe.ping();

      setPasswordFor(id, password);
      if (remember) {
        await saveSecret(secretAccount(id), password);
      } else {
        await deleteSecret(secretAccount(id));
      }

      if (server.savePassword !== remember) {
        const next = { ...server, savePassword: remember };
        await persistServers(
          servers().map((item) => (item.id === id ? next : item)),
        );
      }

      await activate(id, probe);
    } catch (error) {
      setStartupError(subsonicErrorKey(error));
      throw error;
    } finally {
      setConnectingId(null);
    }
  }

  async function disconnect(): Promise<void> {
    setClient(null);
    setActiveId(null);
    await writeSetting("activeServerId", null);
  }

  onMount(async () => {
    const [storedServers, lastActive] = await Promise.all([
      readSetting<ServerConfig[]>("servers", []),
      readSetting<string | null>("activeServerId", null),
    ]);

    const list = Array.isArray(storedServers)
      ? storedServers.filter(isServerConfig)
      : [];
    setServers(list);

    const secrets: Record<string, string> = {};
    await Promise.all(
      list
        .filter((server) => server.savePassword)
        .map(async (server) => {
          const password = await getSecret(secretAccount(server.id));
          if (password) secrets[server.id] = password;
        }),
    );
    setPasswords(secrets);

    // Try to restore the previous session before rendering the app shell so the
    // user does not see a flash of the servers page on every launch.
    if (lastActive && list.some((server) => server.id === lastActive)) {
      try {
        await connect(lastActive);
      } catch {
        // startupError is already set by connect()
      }
    }

    setReady(true);
  });

  const value: ServersContextValue = {
    servers,
    activeId,
    activeServer,
    client,
    passwords,
    ready,
    connectingId,
    startupError,
    clearStartupError: () => setStartupError(null),
    addServer,
    updateServer,
    removeServer,
    connect,
    connectWithPassword,
    disconnect,
  };

  return (
    <ServersContext.Provider value={value}>
      {props.children}
    </ServersContext.Provider>
  );
}

export function useServers(): ServersContextValue {
  const context = useContext(ServersContext);
  if (!context) {
    throw new Error("useServers must be used inside <ServersProvider>");
  }
  return context;
}
