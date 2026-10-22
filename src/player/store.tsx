import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import { createStore } from "solid-js/store";
import type { Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import {
  audioDeviceId,
  audioPlayer,
  maxBitRate,
  mpvAudioDevice,
  scrobble,
  setAudioPlayer,
  streamFormat,
} from "~/state/settings";
import { applyAudioOutput } from "~/lib/audio-output";
import {
  mpvEnsure,
  mpvLoad,
  mpvPause,
  mpvSeek,
  mpvSetAudioDevice,
  mpvSetMute,
  mpvSetVolume,
  mpvStop,
  onMpvEnd,
  onMpvState,
  type MpvSnapshot,
} from "~/lib/mpv";
import { isTauri } from "~/lib/platform";
import { readSetting, writeSetting } from "~/lib/storage";
import { toast } from "~/components/toaster";
import { t } from "~/i18n";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  queue: Song[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  sourceName: string | null;
}

interface PersistedPlayer {
  serverId: string;
  queue: Song[];
  index: number;
  position: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

export interface PlayerContextValue {
  state: PlayerState;
  current: Accessor<Song | null>;
  queueOpen: Accessor<boolean>;
  setQueueOpen: (open: boolean) => void;
  nowPlayingOpen: Accessor<boolean>;
  setNowPlayingOpen: (open: boolean) => void;
  lyricsOpen: Accessor<boolean>;
  toggleLyrics: () => void;
  playNow: (songs: Song[], index?: number, sourceName?: string) => void;
  playSong: (song: Song, context?: Song[], sourceName?: string) => void;
  addToQueue: (songs: Song[]) => void;
  playNext: (songs: Song[]) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  removeAt: (index: number) => void;
  jumpTo: (index: number) => void;
  clearQueue: () => void;
  isCurrent: (songId: string) => boolean;
  isStarred: (song: Song) => boolean;
  patchSongStar: (songId: string, starred: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue>();

const INITIAL_STATE: PlayerState = {
  queue: [],
  index: -1,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  error: null,
  sourceName: null,
};

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function PlayerProvider(props: { children: JSX.Element }) {
  const servers = useServers();
  const [state, setState] = createStore<PlayerState>({ ...INITIAL_STATE });
  const [queueOpen, setQueueOpen] = createSignal(false);
  const [nowPlayingOpen, setNowPlayingOpenSignal] = createSignal(false);
  const [lyricsOpen, setLyricsOpen] = createSignal(false);
  const [persisted, setPersisted] = createSignal<PersistedPlayer | null>(null);
  // Star state shared by the player bar and every track list, so toggling a
  // favorite anywhere updates all of them.
  const [starOverrides, setStarOverrides] = createSignal<Record<string, boolean>>(
    {},
  );

  function setNowPlayingOpen(open: boolean) {
    // Keep the lyrics state: closing and re-opening the full screen player
    // returns to whichever view the user was last looking at.
    setNowPlayingOpenSignal(open);
  }

  function toggleLyrics() {
    if (lyricsOpen()) {
      setLyricsOpen(false);
      return;
    }
    setLyricsOpen(true);
    setNowPlayingOpenSignal(true);
  }

  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = INITIAL_STATE.volume;

  // The MPV engine is validated lazily so a persisted "mpv" setting cannot
  // leave the app with a dead player when libmpv is not installed.
  const [mpvReady, setMpvReady] = createSignal(false);
  // Whether the engine currently has our track loaded. libmpv reports
  // END_FILE (reason STOP) when a file is replaced, which must not clear this.
  let mpvLoaded = false;

  function usingMpv() {
    return isTauri && audioPlayer() === "mpv";
  }

  let pendingSeek = 0;
  let scrobbledCurrent = false;
  let restoreAttempted = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const current = createMemo<Song | null>(
    () => state.queue[state.index] ?? null,
  );

  // Hide the full screen player again when the queue is cleared.
  createEffect(() => {
    if (!current()) setNowPlayingOpen(false);
  });

  function updateMediaSession(track: Song) {
    if (!("mediaSession" in navigator)) return;
    try {
      const client = servers.client();
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist ?? "",
        album: track.album ?? "",
        artwork:
          track.coverArt && client
            ? [
                {
                  src: client.coverUrl(track.coverArt, 512),
                  sizes: "512x512",
                  type: "image/jpeg",
                },
              ]
            : [],
      });
    } catch (error) {
      console.warn("MediaSession metadata failed", error);
    }
  }

  function reportNowPlaying(track: Song) {
    const client = servers.client();
    if (!client || !scrobble()) return;
    void client.scrobble(track.id, false).catch(() => undefined);
  }

  function maybeScrobble() {
    const track = current();
    const client = servers.client();
    if (!track || !client || scrobbledCurrent || !scrobble()) return;
    if (state.duration > 30 && state.position > state.duration / 2) {
      scrobbledCurrent = true;
      void client.scrobble(track.id, true).catch(() => undefined);
    }
  }

  function syncMediaSessionPosition(position: number, duration: number) {
    if (duration <= 0) return;
    try {
      if (!("mediaSession" in navigator)) return;
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(position, 0), duration),
      });
    } catch {
      // not supported
    }
  }

  function applyMpvSnapshot(snapshot: MpvSnapshot) {
    if (!usingMpv()) return;
    setState({
      position: snapshot.position,
      playing: snapshot.playing,
      loading: snapshot.loading,
      ...(snapshot.duration > 0 ? { duration: snapshot.duration } : {}),
    });
    maybeScrobble();
    syncMediaSessionPosition(snapshot.position, snapshot.duration);
  }

  function handleMpvEnd(payload: { eof: boolean; error?: string | null }) {
    if (!usingMpv()) return;
    if (payload.error) {
      mpvLoaded = false;
      setState({
        playing: false,
        loading: false,
        error: t("player.mpvError"),
      });
      toast(t("player.mpvError"), payload.error, "error");
      return;
    }
    if (!payload.eof) {
      // Replacing a file (next/previous/jump) also reports END_FILE with the
      // STOP reason. That is not a real stop, so keep the engine marked as
      // loaded or pause/mute/seek would be skipped for the new track.
      return;
    }
    mpvLoaded = false;
    advance(true);
  }

  function loadAndPlay(
    index: number,
    options: { autoplay?: boolean; position?: number } = {},
  ) {
    const client = servers.client();
    const track = state.queue[index];
    if (!client || !track) return;

    scrobbledCurrent = false;
    const resumeAt = options.position ?? 0;
    pendingSeek = resumeAt;

    setState({
      index,
      error: null,
      loading: true,
      position: resumeAt,
      duration: track.duration ?? 0,
    });

    const url = client.streamUrl(track.id, {
      maxBitRate: maxBitRate(),
      format: streamFormat(),
    });
    updateMediaSession(track);
    reportNowPlaying(track);

    if (usingMpv()) {
      audio.pause();
      audio.removeAttribute("src");
      void mpvLoad(url, {
        position: resumeAt,
        autoplay: options.autoplay !== false,
        volume: state.volume,
        muted: state.muted,
        audioDevice: mpvAudioDevice(),
      })
        .then(() => {
          mpvLoaded = true;
        })
        .catch((error) => {
          console.warn("MPV playback failed", error);
          mpvLoaded = false;
          setState({
            playing: false,
            loading: false,
            error: t("player.mpvError"),
          });
          toast(t("player.mpvError"), String(error), "error");
        });
      return;
    }

    audio.src = url;

    if (options.autoplay !== false) {
      void audio.play().catch((error) => {
        console.warn("Playback failed", error);
        setState({
          playing: false,
          loading: false,
          error: t("player.streamError"),
        });
      });
    } else {
      setState({ playing: false, loading: false });
    }
  }

  function playNow(songs: Song[], index = 0, sourceName?: string) {
    const list = songs.filter(Boolean);
    if (!list.length) return;
    const safeIndex = Math.min(Math.max(index, 0), list.length - 1);
    setState({
      queue: [...list],
      index: safeIndex,
      sourceName: sourceName ?? null,
      position: 0,
      duration: list[safeIndex]?.duration ?? 0,
    });
    loadAndPlay(safeIndex, { autoplay: true });
  }

  function playSong(song: Song, context?: Song[], sourceName?: string) {
    if (context && context.length) {
      const index = context.findIndex((item) => item.id === song.id);
      playNow(context, index >= 0 ? index : 0, sourceName);
    } else {
      playNow([song], 0, sourceName);
    }
  }

  function addToQueue(songs: Song[]) {
    if (!songs.length) return;
    setState("queue", (queue) => [...queue, ...songs]);
    if (state.index < 0) {
      setState({ index: 0, duration: songs[0]?.duration ?? 0 });
    }
  }

  function playNext(songs: Song[]) {
    if (!songs.length) return;
    setState("queue", (queue) => {
      const copy = [...queue];
      copy.splice(state.index + 1, 0, ...songs);
      return copy;
    });
  }

  function play() {
    if (!state.queue.length) return;
    if (state.index < 0) {
      loadAndPlay(0, { autoplay: true });
      return;
    }
    if (usingMpv()) {
      if (!mpvLoaded) {
        loadAndPlay(state.index, {
          autoplay: true,
          position: state.position,
        });
        return;
      }
      void mpvPause(false).catch(() =>
        setState({ playing: false, loading: false }),
      );
      return;
    }
    if (!audio.src) {
      loadAndPlay(state.index, {
        autoplay: true,
        position: state.position,
      });
      return;
    }
    void audio
      .play()
      .catch(() => setState({ playing: false, loading: false }));
  }

  function pause() {
    if (usingMpv()) {
      void mpvPause(true).catch(() => undefined);
      return;
    }
    audio.pause();
  }

  function toggle() {
    if (state.playing) pause();
    else play();
  }

  function advance(auto: boolean) {
    const queue = state.queue;
    if (!queue.length) return;

    if (auto && state.repeat === "one") {
      loadAndPlay(state.index, { autoplay: true });
      return;
    }

    let nextIndex = state.index + 1;
    if (nextIndex >= queue.length) {
      if (auto && state.repeat !== "all") {
        pause();
        setState({ playing: false });
        return;
      }
      nextIndex = 0;
    }
    loadAndPlay(nextIndex, { autoplay: auto || state.playing });
  }

  function next() {
    advance(false);
  }

  function previous() {
    if (state.position > 3) {
      seek(0);
      return;
    }
    if (!state.queue.length) return;
    let nextIndex = state.index - 1;
    if (nextIndex < 0) nextIndex = state.queue.length - 1;
    loadAndPlay(nextIndex, { autoplay: state.playing });
  }

  function seek(seconds: number) {
    const duration = state.duration || current()?.duration || 0;
    const value = Math.min(Math.max(seconds, 0), duration > 0 ? duration : seconds);
    if (usingMpv()) {
      void mpvSeek(value).catch(() => undefined);
    } else {
      try {
        if (Number.isFinite(value)) audio.currentTime = value;
      } catch {
        // seeking before metadata is ready is a no-op
      }
    }
    setState("position", value);
  }

  function setVolume(value: number) {
    const clamped = Math.min(Math.max(value, 0), 1);
    setState({ volume: clamped, muted: clamped === 0 ? state.muted : false });
  }

  function toggleMute() {
    setState("muted", (muted) => !muted);
  }

  function toggleShuffle() {
    if (!state.shuffle) {
      const currentTrack = state.queue[state.index];
      const rest = state.queue.filter((_, index) => index !== state.index);
      const queue = currentTrack ? [currentTrack, ...shuffled(rest)] : shuffled(rest);
      setState({ queue, index: currentTrack ? 0 : state.index, shuffle: true });
    } else {
      setState("shuffle", false);
    }
  }

  function cycleRepeat() {
    setState("repeat", (mode) =>
      mode === "off" ? "all" : mode === "all" ? "one" : "off",
    );
  }

  function clearQueue() {
    audio.pause();
    audio.removeAttribute("src");
    try {
      audio.load();
    } catch {
      // ignore
    }
    if (usingMpv()) void mpvStop().catch(() => undefined);
    mpvLoaded = false;
    setState({
      queue: [],
      index: -1,
      playing: false,
      loading: false,
      position: 0,
      duration: 0,
      sourceName: null,
      error: null,
    });
    toast(t("toast.queueCleared"));
  }

  function removeAt(index: number) {
    if (index < 0 || index >= state.queue.length) return;
    const wasCurrent = index === state.index;
    const wasPlaying = state.playing;
    const queue = state.queue.filter((_, position) => position !== index);

    if (!queue.length) {
      clearQueue();
      return;
    }

    if (wasCurrent) {
      const target = Math.min(index, queue.length - 1);
      setState({ queue, index: target });
      loadAndPlay(target, { autoplay: wasPlaying });
      return;
    }

    setState({
      queue,
      index: index < state.index ? state.index - 1 : state.index,
    });
  }

  function jumpTo(index: number) {
    if (index < 0 || index >= state.queue.length) return;
    loadAndPlay(index, { autoplay: true });
  }

  function isCurrent(songId: string) {
    return current()?.id === songId;
  }

  function isStarred(song: Song) {
    return starOverrides()[song.id] ?? Boolean(song.starred);
  }

  function patchSongStar(songId: string, starred: boolean) {
    setStarOverrides((overrides) => ({ ...overrides, [songId]: starred }));
    setState("queue", (queue) =>
      queue.map((song) =>
        song.id === songId
          ? { ...song, starred: starred ? new Date().toISOString() : undefined }
          : song,
      ),
    );
  }

  function saveNow() {
    const serverId = servers.activeId();
    if (!serverId || state.queue.length === 0) {
      void writeSetting("player", null);
      return;
    }
    const payload: PersistedPlayer = {
      serverId,
      queue: state.queue,
      index: state.index,
      position: state.position,
      volume: state.volume,
      shuffle: state.shuffle,
      repeat: state.repeat,
    };
    void writeSetting("player", payload);
  }

  function scheduleSave(delay = 700) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, delay);
  }

  audio.addEventListener("timeupdate", () => {
    setState("position", audio.currentTime || 0);
    maybeScrobble();
    try {
      if ("mediaSession" in navigator && state.duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: state.duration,
          playbackRate: audio.playbackRate,
          position: Math.min(audio.currentTime, state.duration),
        });
      }
    } catch {
      // not supported
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    const duration = Number.isFinite(audio.duration)
      ? audio.duration
      : (current()?.duration ?? 0);
    setState("duration", duration);
    if (pendingSeek > 0) {
      try {
        audio.currentTime = pendingSeek;
      } catch {
        // ignore
      }
      pendingSeek = 0;
    }
  });

  audio.addEventListener("durationchange", () => {
    if (Number.isFinite(audio.duration)) setState("duration", audio.duration);
  });

  audio.addEventListener("playing", () => {
    setState({ playing: true, loading: false, error: null });
  });

  audio.addEventListener("pause", () => setState("playing", false));

  audio.addEventListener("waiting", () => setState("loading", true));

  audio.addEventListener("canplay", () => setState("loading", false));

  audio.addEventListener("ended", () => advance(true));

  audio.addEventListener("error", () => {
    if (!audio.src) return;
    setState({
      playing: false,
      loading: false,
      error: t("player.streamError"),
    });
  });

  createEffect(() => {
    audio.volume = state.volume;
    audio.muted = state.muted;
    if (usingMpv()) {
      void mpvSetVolume(state.volume).catch(() => undefined);
      void mpvSetMute(state.muted).catch(() => undefined);
    }
  });

  // Switch the mpv engine to the speaker picked in Settings. New tracks get
  // the device through mpvLoad, so this only needs to handle live changes.
  createEffect(() => {
    const device = mpvAudioDevice();
    if (usingMpv() && mpvLoaded) {
      void mpvSetAudioDevice(device).catch(() => undefined);
    }
  });

  // Make sure the saved engine really works before any track is loaded into
  // it; libmpv is optional and may not be installed on this machine.
  createEffect(() => {
    if (!isTauri || audioPlayer() !== "mpv") {
      setMpvReady(false);
      return;
    }
    if (mpvReady()) return;
    void (async () => {
      const status = await mpvEnsure();
      if (status.available) {
        setMpvReady(true);
        return;
      }
      setAudioPlayer("web");
      toast(t("settings.mpvMissingTitle"), status.error ?? undefined, "error");
    })();
  });

  // Move the current track between the two engines when the setting changes,
  // keeping the position and the play/pause state.
  createEffect(
    on(
      () => [audioPlayer(), mpvReady()] as const,
      (value, previous) => {
        const [engine, ready] = value;
        if (!previous) return;
        const engineChanged = engine !== previous[0];
        const becameReady = engine === "mpv" && ready && !previous[1];
        if (!engineChanged && !becameReady) return;
        if (engine === "mpv" && !ready) return;

        const index = state.index;
        const wasPlaying = state.playing;
        const position = state.position;

        if (engine === "web") {
          if (previous[0] === "mpv") {
            void mpvStop().catch(() => undefined);
          }
          mpvLoaded = false;
        } else {
          audio.pause();
          audio.removeAttribute("src");
        }

        if (index >= 0) {
          loadAndPlay(index, { autoplay: wasPlaying, position });
        }
      },
    ),
  );

  // Follow the playback output chosen in Settings. Persisted device ids are
  // stable per origin, so this also re-applies after a restart.
  createEffect(() => {
    const deviceId = audioDeviceId();
    if (audioPlayer() !== "web") return;
    void applyAudioOutput(audio, deviceId);
  });

  createEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = state.playing
        ? "playing"
        : "paused";
    }
  });

  // Stop and reset the queue when the active server changes.
  createEffect(
    on(
      servers.activeId,
      (id, previous) => {
        if (previous === undefined || id === previous) return;
        audio.pause();
        audio.removeAttribute("src");
        if (usingMpv()) void mpvStop().catch(() => undefined);
        mpvLoaded = false;
        setState({
          queue: [],
          index: -1,
          playing: false,
          loading: false,
          position: 0,
          duration: 0,
          sourceName: null,
          error: null,
        });
      },
      { defer: true },
    ),
  );

  // Restore the previously playing queue once a client is available.
  createEffect(() => {
    if (restoreAttempted) return;
    const saved = persisted();
    const client = servers.client();
    const id = servers.activeId();
    if (!saved || !client || !id) return;
    restoreAttempted = true;
    if (saved.serverId !== id || !saved.queue?.length) return;

    const index = Math.min(Math.max(saved.index ?? 0, 0), saved.queue.length - 1);
    setState({
      queue: saved.queue,
      index,
      position: saved.position ?? 0,
      duration: saved.queue[index]?.duration ?? 0,
      volume: typeof saved.volume === "number" ? saved.volume : 0.8,
      shuffle: Boolean(saved.shuffle),
      repeat: saved.repeat ?? "off",
    });
  });

  createEffect(
    on(
      () => [
        state.queue,
        state.index,
        state.volume,
        state.shuffle,
        state.repeat,
        servers.activeId(),
      ],
      () => scheduleSave(700),
    ),
  );

  onMount(() => {
    void readSetting<PersistedPlayer | null>("player", null).then((saved) => {
      setPersisted(saved);
      if (saved && typeof saved.volume === "number") {
        setState("volume", saved.volume);
      }
    });

    // Re-apply the chosen output when devices appear (for example right after
    // the user unlocks the speaker list in Settings).
    const handleDeviceChange = () => {
      if (audioPlayer() === "web") {
        void applyAudioOutput(audio, audioDeviceId());
      }
    };
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);

    // Playback state from libmpv arrives as events; the Rust engine is the
    // source of truth while MPV is selected.
    const unlisteners: Array<() => void> = [];
    let disposed = false;
    const keep = (promise: Promise<() => void>) => {
      void promise.then((off) => {
        if (disposed) off();
        else unlisteners.push(off);
      });
    };
    keep(onMpvState(applyMpvSnapshot));
    keep(onMpvEnd(handleMpvEnd));

    const interval = setInterval(() => {
      if (state.playing) saveNow();
    }, 12000);

    const handleUnload = () => saveNow();
    window.addEventListener("beforeunload", handleUnload);

    onCleanup(() => {
      disposed = true;
      for (const off of unlisteners) off();
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
      if (saveTimer) clearTimeout(saveTimer);
    });

    if ("mediaSession" in navigator) {
      const handlers: Array<[MediaSessionAction, () => void]> = [
        ["play", () => play()],
        ["pause", () => pause()],
        ["nexttrack", () => next()],
        ["previoustrack", () => previous()],
        ["seekbackward", () => seek(state.position - 10)],
        ["seekforward", () => seek(state.position + 10)],
        ["stop", () => pause()],
      ];
      for (const [action, handler] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          // action not supported
        }
      }
    }
  });

  const value: PlayerContextValue = {
    state,
    current,
    queueOpen,
    setQueueOpen,
    nowPlayingOpen,
    setNowPlayingOpen,
    lyricsOpen,
    toggleLyrics,
    playNow,
    playSong,
    addToQueue,
    playNext,
    toggle,
    play,
    pause,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    removeAt,
    jumpTo,
    clearQueue,
    isCurrent,
    isStarred,
    patchSongStar,
  };

  return (
    <PlayerContext.Provider value={value}>
      {props.children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used inside <PlayerProvider>");
  }
  return context;
}
