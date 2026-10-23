import { md5 } from "js-md5";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { isTauri } from "./platform";
import type {
  Album,
  AlbumListType,
  Artist,
  Genre,
  Lyrics,
  Playlist,
  SearchResult,
  ServerInfo,
  Song,
  StarredResult,
} from "./types";

export const API_VERSION = "1.16.1";
export const CLIENT_NAME = "StepUnder";

type ParamValue = string | number | boolean | null | undefined;
/** Arrays become repeated query keys (`songId=1&songId=2`). */
type Params = Record<string, ParamValue | ParamValue[]>;
type Json = Record<string, any>;

/** Error coming from the Subsonic API or the transport layer. */
export class SubsonicError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "SubsonicError";
    this.code = code;
  }
}

/**
 * Accepts "music.example.com", "music.example.com/navidrome" or a full URL and
 * returns a normalized base URL without a trailing slash.
 */
export function normalizeServerUrl(raw: string): string {
  let value = raw.trim();
  if (!value) throw new Error("empty-url");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid-protocol");
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

const SALT_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Tauri's HTTP plugin bypasses CORS; browsers use the standard fetch. */
const httpFetch: typeof fetch = isTauri
  ? (tauriFetch as unknown as typeof fetch)
  : globalThis.fetch.bind(globalThis);

function randomSalt(length = 8) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let salt = "";
  for (const byte of bytes) salt += SALT_CHARS[byte % SALT_CHARS.length];
  return salt;
}

function clean(value: ParamValue): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Normalizes OpenSubsonic `structuredLyrics` into plain/synced lines. */
function parseStructuredLyrics(raw: any): Lyrics | null {
  const entries = toArray<any>(raw?.structuredLyrics);
  for (const entry of entries) {
    if (!entry) continue;
    const lines = toArray<any>(entry.line)
      .map((line) => ({
        start:
          typeof line?.start === "number" ? line.start / 1000 : undefined,
        value: String(line?.value ?? "").trim(),
      }))
      .filter((line) => line.value.length > 0);
    if (lines.length) {
      return { synced: Boolean(entry.synced), lines };
    }
  }
  return null;
}

export interface StreamOptions {
  maxBitRate?: number;
  format?: string;
}

/**
 * Minimal Subsonic / OpenSubsonic client tailored for Navidrome.
 * Requests run through the Tauri HTTP plugin so browser CORS never applies.
 */
export class SubsonicClient {
  readonly baseUrl: string;
  readonly username: string;
  private readonly password: string;

  constructor(config: { url: string; username: string; password: string }) {
    this.baseUrl = normalizeServerUrl(config.url);
    this.username = config.username;
    this.password = config.password;
  }

  private buildUrl(
    endpoint: string,
    params: Params = {},
    options: { auth?: boolean; json?: boolean } = {},
  ) {
    const { auth = true, json = true } = options;
    const url = new URL(`${this.baseUrl}/rest/${endpoint}`);

    if (auth) {
      const salt = randomSalt();
      url.searchParams.set("u", this.username);
      url.searchParams.set("t", md5(this.password + salt));
      url.searchParams.set("s", salt);
      url.searchParams.set("v", API_VERSION);
      url.searchParams.set("c", CLIENT_NAME);
    }
    if (json) url.searchParams.set("f", "json");

    for (const [key, value] of Object.entries(params)) {
      for (const item of toArray(value)) {
        const cleaned = clean(item);
        if (cleaned !== undefined) url.searchParams.append(key, cleaned);
      }
    }

    return url.toString();
  }

  /**
   * Runs a Subsonic call. `post` sends the parameters as a form body instead
   * of the query string, for calls that may carry hundreds of song ids.
   */
  private async request<T extends Json = Json>(
    endpoint: string,
    params: Params = {},
    timeoutMs = 20000,
    post = false,
  ): Promise<T & Json> {
    const url = this.buildUrl(endpoint, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      if (post) {
        const [base, query] = url.split("?");
        response = (await httpFetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: query,
          signal: controller.signal,
        })) as unknown as Response;
      } else {
        response = (await httpFetch(url, {
          method: "GET",
          signal: controller.signal,
        })) as unknown as Response;
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new SubsonicError(-3, "Request timed out");
      }
      throw new SubsonicError(-3, error?.message ?? "Network request failed");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new SubsonicError(response.status, `HTTP ${response.status}`);
    }

    const text = await response.text();
    let payload: Json;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new SubsonicError(-2, "The server returned an invalid response");
    }

    const body = payload["subsonic-response"] ?? payload["subsonicResponse"];
    if (!body) {
      throw new SubsonicError(-2, "The server returned an invalid response");
    }
    if (body.status === "failed" || body.error) {
      throw new SubsonicError(
        Number(body.error?.code ?? 0),
        String(body.error?.message ?? "Unknown error"),
      );
    }
    return body as T & Json;
  }

  // ---------------------------------------------------------------- system
  async ping(): Promise<boolean> {
    await this.request("ping", {}, 12000);
    return true;
  }

  async getServerInfo(): Promise<ServerInfo> {
    const body = await this.request("ping", {}, 12000);
    return {
      version: typeof body.version === "string" ? body.version : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      serverVersion:
        typeof body.serverVersion === "string" ? body.serverVersion : undefined,
      openSubsonic:
        typeof body.openSubsonic === "boolean" ? body.openSubsonic : undefined,
    };
  }

  // ---------------------------------------------------------------- browse
  async getAlbumList2(
    type: AlbumListType = "alphabeticalByName",
    size = 50,
    offset = 0,
  ): Promise<Album[]> {
    const body = await this.request("getAlbumList2", { type, size, offset });
    return (body.albumList2?.album ?? []) as Album[];
  }

  async getAlbum(id: string): Promise<{ album: Album; songs: Song[] }> {
    const body = await this.request("getAlbum", { id });
    const album = (body.album ?? { id, name: "" }) as Album;
    return { album, songs: (album.song ?? []) as Song[] };
  }

  /** Full song entry, including any extra OpenSubsonic fields the server sends. */
  async getSong(id: string): Promise<Song & Json> {
    const body = await this.request("getSong", { id });
    return (body.song ?? { id, title: "" }) as Song & Json;
  }

  async getArtists(): Promise<Artist[]> {
    const body = await this.request("getArtists");
    const indexes = (body.artists?.index ?? []) as Array<{ artist?: Artist[] }>;
    return indexes.flatMap((index) => index.artist ?? []);
  }

  async getArtist(id: string): Promise<{ artist: Artist; albums: Album[] }> {
    const body = await this.request("getArtist", { id });
    const artist = (body.artist ?? { id, name: "" }) as Artist;
    return {
      artist,
      albums: ((artist as Artist & { album?: Album[] }).album ?? []) as Album[],
    };
  }

  async getTopSongs(artistName: string, count = 20): Promise<Song[]> {
    try {
      const body = await this.request("getTopSongs", {
        artist: artistName,
        count,
      });
      return (body.topSongs?.song ?? []) as Song[];
    } catch {
      return [];
    }
  }

  /** Songs similar to a song, album or artist id (Navidrome resolves all three). */
  async getSimilarSongs(id: string, count = 50): Promise<Song[]> {
    const body = await this.request("getSimilarSongs", { id, count });
    return (body.similarSongs?.song ?? []) as Song[];
  }

  async getSimilarSongs2(artistId: string, count = 50): Promise<Song[]> {
    const body = await this.request("getSimilarSongs2", { id: artistId, count });
    return (body.similarSongs2?.song ?? []) as Song[];
  }

  async getGenres(): Promise<Genre[]> {
    const body = await this.request("getGenres");
    return (body.genres?.genre ?? []) as Genre[];
  }

  async getAlbumsByGenre(genre: string, size = 50, offset = 0): Promise<Album[]> {
    const body = await this.request("getAlbumList2", {
      type: "byGenre",
      genre,
      size,
      offset,
    });
    return (body.albumList2?.album ?? []) as Album[];
  }

  async getSongsByGenre(genre: string, count = 50, offset = 0): Promise<Song[]> {
    const body = await this.request("getSongsByGenre", { genre, count, offset });
    return (body.songsByGenre?.song ?? []) as Song[];
  }

  async getPlaylists(): Promise<Playlist[]> {
    const body = await this.request("getPlaylists");
    return (body.playlists?.playlist ?? []) as Playlist[];
  }

  async getPlaylist(id: string): Promise<{ playlist: Playlist; songs: Song[] }> {
    const body = await this.request("getPlaylist", { id });
    const playlist = (body.playlist ?? { id, name: "" }) as Playlist;
    return { playlist, songs: (playlist.entry ?? []) as Song[] };
  }

  async createPlaylist(name: string, songIds: string[] = []): Promise<Playlist> {
    const body = await this.request(
      "createPlaylist",
      { name, songId: songIds },
      20000,
      true,
    );
    if (body.playlist?.id) return body.playlist as Playlist;
    // Servers older than API 1.14 return nothing; find the newest match instead.
    const playlists = await this.getPlaylists();
    const matches = playlists.filter((playlist) => playlist.name === name);
    const created = matches.sort((a, b) =>
      String(b.created ?? "").localeCompare(String(a.created ?? "")),
    )[0];
    if (!created) throw new SubsonicError(-2, "Playlist was not created");
    return created;
  }

  async updatePlaylist(
    id: string,
    changes: {
      name?: string;
      comment?: string;
      public?: boolean;
      songIdsToAdd?: string[];
      songIndexesToRemove?: number[];
    },
  ): Promise<void> {
    await this.request(
      "updatePlaylist",
      {
        playlistId: id,
        name: changes.name,
        // An empty string is dropped by buildUrl, so send a space to clear it.
        comment: changes.comment === "" ? " " : changes.comment,
        public: changes.public,
        songIdToAdd: changes.songIdsToAdd,
        songIndexToRemove: changes.songIndexesToRemove,
      },
      20000,
      true,
    );
  }

  /**
   * Overwrites the playlist's songs with `songIds`, in that order. Goes through
   * updatePlaylist (drop every index, re-add in order) rather than
   * createPlaylist so admins may also reorder playlists they do not own.
   */
  async replacePlaylistSongs(
    id: string,
    currentCount: number,
    songIds: string[],
  ): Promise<void> {
    await this.request(
      "updatePlaylist",
      {
        playlistId: id,
        songIndexToRemove: Array.from({ length: currentCount }, (_, i) => i),
        songIdToAdd: songIds,
      },
      30000,
      true,
    );
  }

  /** Whether the signed-in account has the admin role. */
  async isAdmin(): Promise<boolean> {
    try {
      const body = await this.request("getUser", { username: this.username });
      return body.user?.adminRole === true;
    } catch {
      return false;
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.request("deletePlaylist", { id });
  }

  // ------------------------------------------------- Navidrome native API
  private nativeToken: string | null = null;

  private async nativeLogin(): Promise<string> {
    let response: Response;
    try {
      response = (await httpFetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      })) as unknown as Response;
    } catch (error: any) {
      throw new SubsonicError(-3, error?.message ?? "Network request failed");
    }
    if (response.status === 401) throw new SubsonicError(40, "Login failed");
    if (response.status === 404) {
      throw new SubsonicError(-4, "Not a Navidrome server");
    }
    if (!response.ok) {
      throw new SubsonicError(response.status, `HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => null)) as Json | null;
    if (!body?.token) {
      throw new SubsonicError(-2, "The server returned an invalid response");
    }
    this.nativeToken = String(body.token);
    return this.nativeToken;
  }

  /** Calls Navidrome's own REST API, logging in (again) when needed. */
  private async nativeRequest(
    path: string,
    init: { method: string; body?: BodyInit },
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = this.nativeToken ?? (await this.nativeLogin());
      let response: Response;
      try {
        response = (await httpFetch(`${this.baseUrl}/api/${path}`, {
          method: init.method,
          headers: { "x-nd-authorization": `Bearer ${token}` },
          body: init.body,
        })) as unknown as Response;
      } catch (error: any) {
        throw new SubsonicError(-3, error?.message ?? "Network request failed");
      }
      if (response.status === 401 && attempt === 0) {
        this.nativeToken = null;
        continue;
      }
      if (response.ok) return;
      if (response.status === 404 || response.status === 405) {
        throw new SubsonicError(-4, "Not supported by this server");
      }
      if (response.status === 403) throw new SubsonicError(50, "Forbidden");
      throw new SubsonicError(response.status, `HTTP ${response.status}`);
    }
    throw new SubsonicError(40, "Login failed");
  }

  /** Custom playlist cover (Navidrome 0.61+). */
  async uploadPlaylistImage(id: string, image: Blob, filename = "cover.jpg") {
    const form = new FormData();
    form.append("image", image, filename);
    await this.nativeRequest(`playlist/${encodeURIComponent(id)}/image`, {
      method: "POST",
      body: form,
    });
  }

  /** Drops the custom cover so the server falls back to its generated mosaic. */
  async removePlaylistImage(id: string) {
    await this.nativeRequest(`playlist/${encodeURIComponent(id)}/image`, {
      method: "DELETE",
    });
  }

  async getRandomSongs(size = 50): Promise<Song[]> {
    const body = await this.request("getRandomSongs", { size });
    return (body.randomSongs?.song ?? []) as Song[];
  }

  async getStarred2(): Promise<StarredResult> {
    const body = await this.request("getStarred2");
    return {
      artists: (body.starred2?.artist ?? []) as Artist[],
      albums: (body.starred2?.album ?? []) as Album[],
      songs: (body.starred2?.song ?? []) as Song[],
    };
  }

  async search3(query: string, limit = 25): Promise<SearchResult> {
    const body = await this.request("search3", {
      query,
      artistCount: limit,
      albumCount: limit,
      songCount: limit,
    });
    return {
      artists: (body.searchResult3?.artist ?? []) as Artist[],
      albums: (body.searchResult3?.album ?? []) as Album[],
      songs: (body.searchResult3?.song ?? []) as Song[],
    };
  }

  // ------------------------------------------------------------- annotation
  async star(id: string): Promise<void> {
    await this.request("star", { id });
  }

  async unstar(id: string): Promise<void> {
    await this.request("unstar", { id });
  }

  async scrobble(id: string, submission = true): Promise<void> {
    await this.request("scrobble", { id, submission });
  }

  // ---------------------------------------------------------------- lyrics
  async getLyricsBySongId(songId: string): Promise<Lyrics | null> {
    try {
      const body = await this.request("getLyricsBySongId", { id: songId });
      return parseStructuredLyrics(body.lyricsList);
    } catch {
      return null;
    }
  }

  /** Legacy Subsonic fallback: lyrics are matched by artist and title. */
  async getLyrics(artistName: string, title: string): Promise<Lyrics | null> {
    try {
      const body = await this.request("getLyrics", {
        artist: artistName,
        title,
      });
      const structured = parseStructuredLyrics(
        body.lyricsList ?? body.lyrics,
      );
      if (structured) return structured;

      const value: string =
        typeof body.lyrics?.value === "string"
          ? String(body.lyrics.value)
          : "";
      const lines = value.split(/\r?\n/).map((line) => line.trim());
      while (lines.length && !lines[0]) lines.shift();
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      return lines.length
        ? { synced: false, lines: lines.map((line) => ({ value: line })) }
        : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------ media
  coverUrl(coverArtId: string, size = 300): string {
    return this.buildUrl(
      "getCoverArt",
      { id: coverArtId, size },
      { json: false },
    );
  }

  streamUrl(songId: string, options: StreamOptions = {}): string {
    return this.buildUrl(
      "stream",
      {
        id: songId,
        maxBitRate: options.maxBitRate && options.maxBitRate > 0 ? options.maxBitRate : undefined,
        format: options.format && options.format !== "raw" ? options.format : undefined,
      },
      { json: false },
    );
  }
}

export function isSubsonicError(error: unknown): error is SubsonicError {
  return error instanceof SubsonicError;
}

/** Stable id used for i18n lookups of API errors. */
export function subsonicErrorKey(error: unknown): string {
  if (error instanceof SubsonicError) {
    if (error.code === 40) return "error.authFailed";
    if (error.code === 50) return "error.notAuthorized";
    if (error.code === 70) return "error.notFound";
    if (error.code === -3) return "error.unreachable";
    if (error.code === -4) return "error.unsupported";
    if (error.code === 10) return "error.invalidRequest";
  }
  return "error.generic";
}
