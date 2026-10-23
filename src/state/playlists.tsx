import {
  createContext,
  createMemo,
  createResource,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import type { Playlist, Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import { t, type MessageKey } from "~/i18n";
import { subsonicErrorKey } from "~/lib/subsonic";
import { toast } from "~/components/toaster";
import {
  AddToPlaylistDialog,
  DeletePlaylistDialog,
  PlaylistFormDialog,
  type CoverImage,
  type PlaylistFormValues,
} from "~/components/playlist-dialogs";

export interface PlaylistsContextValue {
  playlists: Accessor<Playlist[]>;
  loading: Accessor<boolean>;
  error: Accessor<unknown>;
  reload: () => void;
  /** Playlists the signed-in user may change: their own, or all for admins. */
  editable: Accessor<Playlist[]>;
  canEdit: (playlist: Playlist | undefined | null) => boolean;
  /** Increments whenever a playlist changes, so open pages can refetch. */
  revision: Accessor<number>;
  coverKey: (id: string) => number;
  openCreate: (songs?: Song[]) => void;
  openEdit: (playlist: Playlist) => void;
  openDelete: (playlist: Playlist) => void;
  openAddTo: (songs: Song[]) => void;
}

const PlaylistsContext = createContext<PlaylistsContextValue>();

function errorMessage(error: unknown) {
  return t(subsonicErrorKey(error) as MessageKey);
}

export function PlaylistsProvider(props: { children: JSX.Element }) {
  const servers = useServers();
  const navigate = useNavigate();
  const location = useLocation();

  const [list, { refetch }] = createResource(
    () => servers.client() ?? undefined,
    (client) => client.getPlaylists(),
  );
  const [revision, setRevision] = createSignal(0);
  const [coverKeys, setCoverKeys] = createSignal<Record<string, number>>({});

  const [formOpen, setFormOpen] = createSignal(false);
  const [formPlaylist, setFormPlaylist] = createSignal<Playlist | null>(null);
  const [pendingSongs, setPendingSongs] = createSignal<Song[]>([]);
  const [addOpen, setAddOpen] = createSignal(false);
  const [deleteOpen, setDeleteOpen] = createSignal(false);
  const [deleteTarget, setDeleteTarget] = createSignal<Playlist | null>(null);

  const [admin] = createResource(
    () => servers.client() ?? undefined,
    (client) => client.isAdmin(),
  );

  const playlists = () => list.latest ?? [];

  function canEdit(playlist: Playlist | undefined | null) {
    const client = servers.client();
    if (!playlist || !client) return false;
    if (admin.latest) return true;
    // Servers that omit the owner only list the user's own playlists.
    return !playlist.owner || playlist.owner === client.username;
  }

  const editable = createMemo(() => playlists().filter(canEdit));

  function changed() {
    setRevision((value) => value + 1);
    void refetch();
  }

  function bumpCover(id: string) {
    setCoverKeys((keys) => ({ ...keys, [id]: (keys[id] ?? 0) + 1 }));
  }

  /** Uploads or removes the cover; reports failures without undoing the rest. */
  async function applyImage(id: string, image: CoverImage | null | undefined) {
    const client = servers.client();
    if (!client || image === undefined) return true;
    try {
      if (image) await client.uploadPlaylistImage(id, image.blob, image.filename);
      else await client.removePlaylistImage(id);
      bumpCover(id);
      return true;
    } catch (error) {
      const key = subsonicErrorKey(error);
      toast(
        t("playlist.toast.imageFailed"),
        key === "error.unsupported"
          ? t("playlist.toast.imageUnsupported")
          : errorMessage(error),
        "error",
      );
      return false;
    }
  }

  async function submitForm(values: PlaylistFormValues) {
    const client = servers.client();
    if (!client) throw new Error(t("empty.noServer"));
    const existing = formPlaylist();

    try {
      if (existing) {
        await client.updatePlaylist(existing.id, {
          name: values.name,
          comment: values.comment,
          public: values.isPublic,
        });
        await applyImage(existing.id, values.image);
        toast(t("toast.saved"), undefined, "success");
        changed();
        return;
      }

      const songs = pendingSongs();
      const created = await client.createPlaylist(
        values.name,
        songs.map((song) => song.id),
      );
      // createPlaylist only takes a name and songs; the rest needs an update.
      if (values.comment || values.isPublic) {
        await client.updatePlaylist(created.id, {
          comment: values.comment || undefined,
          public: values.isPublic,
        });
      }
      await applyImage(created.id, values.image);
      toast(
        t("playlist.toast.created", { name: values.name }),
        songs.length
          ? t("playlist.songCount", { count: songs.length })
          : undefined,
        "success",
      );
      changed();
      if (!songs.length) navigate(`/playlist/${created.id}`);
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }

  async function addTo(playlist: Playlist) {
    const client = servers.client();
    const songs = pendingSongs();
    if (!client || !songs.length) return;
    try {
      await client.updatePlaylist(playlist.id, {
        songIdsToAdd: songs.map((song) => song.id),
      });
      toast(
        t("playlist.toast.added", { name: playlist.name }),
        t("playlist.songCount", { count: songs.length }),
        "success",
      );
      changed();
    } catch (error) {
      toast(errorMessage(error), undefined, "error");
      throw error;
    }
  }

  async function confirmDelete() {
    const client = servers.client();
    const target = deleteTarget();
    if (!client || !target) return;
    try {
      await client.deletePlaylist(target.id);
      toast(t("playlist.toast.deleted", { name: target.name }), undefined, "success");
      if (location.pathname === `/playlist/${target.id}`) navigate("/playlists");
      changed();
    } catch (error) {
      toast(errorMessage(error), undefined, "error");
      throw error;
    }
  }

  const value: PlaylistsContextValue = {
    playlists,
    loading: () => list.loading,
    error: () => list.error,
    reload: () => void refetch(),
    editable,
    canEdit,
    revision,
    coverKey: (id) => coverKeys()[id] ?? 0,
    openCreate(songs = []) {
      setPendingSongs(songs);
      setFormPlaylist(null);
      setAddOpen(false);
      setFormOpen(true);
    },
    openEdit(playlist) {
      setPendingSongs([]);
      setFormPlaylist(playlist);
      setFormOpen(true);
    },
    openDelete(playlist) {
      setDeleteTarget(playlist);
      setDeleteOpen(true);
    },
    openAddTo(songs) {
      if (!songs.length) return;
      setPendingSongs(songs);
      void refetch();
      setAddOpen(true);
    },
  };

  return (
    <PlaylistsContext.Provider value={value}>
      {props.children}
      <PlaylistFormDialog
        open={formOpen()}
        onOpenChange={setFormOpen}
        playlist={formPlaylist()}
        pendingSongCount={pendingSongs().length}
        coverKey={formPlaylist() ? value.coverKey(formPlaylist()!.id) : 0}
        onSubmit={submitForm}
      />
      <AddToPlaylistDialog
        open={addOpen()}
        onOpenChange={setAddOpen}
        songCount={pendingSongs().length}
        playlists={editable()}
        loading={list.loading && !list.latest}
        coverKey={value.coverKey}
        onPick={addTo}
        onCreateNew={() => value.openCreate(pendingSongs())}
      />
      <DeletePlaylistDialog
        open={deleteOpen()}
        onOpenChange={setDeleteOpen}
        playlist={deleteTarget()}
        onConfirm={confirmDelete}
      />
    </PlaylistsContext.Provider>
  );
}

export function usePlaylists(): PlaylistsContextValue {
  const context = useContext(PlaylistsContext);
  if (!context) {
    throw new Error("usePlaylists must be used inside <PlaylistsProvider>");
  }
  return context;
}
