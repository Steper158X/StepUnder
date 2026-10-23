/** Domain types shared across the app. */

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
  username: string;
  savePassword: boolean;
  createdAt: number;
}

export interface ServerInput {
  name: string;
  url: string;
  username: string;
  password: string;
  savePassword: boolean;
}

export interface Song {
  id: string;
  title: string;
  album?: string;
  albumId?: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  duration?: number;
  track?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  starred?: string;
  size?: number;
  suffix?: string;
  bitRate?: number;
  /** OpenSubsonic: sample rate in Hz. */
  samplingRate?: number;
  /** OpenSubsonic: bits per sample, lossless formats only. */
  bitDepth?: number;
  contentType?: string;
  playCount?: number;
  played?: string;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  songCount?: number;
  duration?: number;
  year?: number;
  genre?: string;
  starred?: string;
  created?: string;
  playCount?: number;
  played?: string;
  song?: Song[];
}

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
  artistImageUrl?: string;
  starred?: string;
}

export interface Playlist {
  id: string;
  name: string;
  comment?: string;
  owner?: string;
  public?: boolean;
  songCount?: number;
  duration?: number;
  created?: string;
  changed?: string;
  coverArt?: string;
  entry?: Song[];
}

export interface Genre {
  value: string;
  songCount?: number;
  albumCount?: number;
}

export interface SearchResult {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
}

export interface StarredResult {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
}

export interface LyricLine {
  /** Start time in seconds (only present for synced lyrics). */
  start?: number;
  value: string;
}

export interface Lyrics {
  synced: boolean;
  lines: LyricLine[];
}

export interface ServerInfo {
  version?: string;
  type?: string;
  serverVersion?: string;
  openSubsonic?: boolean;
}

export type AlbumListType =
  | "newest"
  | "recent"
  | "frequent"
  | "random"
  | "alphabeticalByName"
  | "alphabeticalByArtist"
  | "starred"
  | "highest";
