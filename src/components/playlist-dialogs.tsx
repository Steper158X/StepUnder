import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { ImagePlus, ListMusic, Plus, Search, Trash2 } from "lucide-solid";
import type { Playlist } from "~/lib/types";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import {
  COVER_IMAGE_TYPES,
  CoverImageError,
  prepareCoverImage,
} from "~/lib/image";
import { Cover, Spinner } from "~/components/common";
import { Button } from "~/components/ui/button";
import { CheckboxField } from "~/components/ui/checkbox";
import { FieldError, Input, Label } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export interface CoverImage {
  blob: Blob;
  filename: string;
}

export interface PlaylistFormValues {
  name: string;
  comment: string;
  isPublic: boolean;
  /** `undefined` keeps the current cover, `null` removes the custom one. */
  image: CoverImage | null | undefined;
}

export function PlaylistFormDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set, creating otherwise. */
  playlist?: Playlist | null;
  /** Songs that will be added to a newly created playlist. */
  pendingSongCount?: number;
  coverKey?: number;
  onSubmit: (values: PlaylistFormValues) => Promise<void>;
}) {
  const [name, setName] = createSignal("");
  const [comment, setComment] = createSignal("");
  const [isPublic, setIsPublic] = createSignal(false);
  const [image, setImage] = createSignal<CoverImage | null | undefined>();
  const [preview, setPreview] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  let fileInput: HTMLInputElement | undefined;

  const editing = () => Boolean(props.playlist);

  function setPreviewUrl(url: string | null) {
    const previous = preview();
    if (previous) URL.revokeObjectURL(previous);
    setPreview(url);
  }
  onCleanup(() => setPreviewUrl(null));

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setName(props.playlist?.name ?? "");
        setComment(props.playlist?.comment?.trim() ?? "");
        setIsPublic(props.playlist?.public ?? false);
        setImage(undefined);
        setPreviewUrl(null);
        setError(null);
        setSaving(false);
      },
    ),
  );

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const prepared = await prepareCoverImage(file);
      setImage(prepared);
      setPreviewUrl(URL.createObjectURL(prepared.blob));
    } catch (failure) {
      const reason = failure instanceof CoverImageError ? failure.reason : "decode";
      setError(
        t(
          reason === "type"
            ? "playlist.form.imageType"
            : reason === "size"
              ? "playlist.form.imageSize"
              : "playlist.form.imageDecode",
        ),
      );
    }
  }

  function removeImage() {
    setPreviewUrl(null);
    setImage(editing() ? null : undefined);
  }

  // Show the server's cover unless the user picked or removed one.
  const showServerCover = () => editing() && image() === undefined;
  const hasCover = () => Boolean(preview()) || showServerCover();

  async function submit(event: Event) {
    event.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) {
      setError(t("error.required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await props.onSubmit({
        name: trimmed,
        comment: comment().trim(),
        isPublic: isPublic(),
        image: image(),
      });
      props.onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("error.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => !saving() && props.onOpenChange(open)}>
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(editing() ? "playlist.form.editTitle" : "playlist.form.createTitle")}
          </DialogTitle>
          <Show when={!editing() && props.pendingSongCount}>
            <DialogDescription>
              {t("playlist.form.pendingSongs", { count: props.pendingSongCount! })}
            </DialogDescription>
          </Show>
        </DialogHeader>

        <form class="flex flex-col gap-5 sm:flex-row" onSubmit={submit}>
          <div class="flex flex-col items-center gap-2">
            <button
              type="button"
              class="group relative size-40 shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => fileInput?.click()}
              aria-label={t("playlist.form.chooseImage")}
              disabled={saving()}
            >
              <Show
                when={preview()}
                fallback={
                  <Show
                    when={showServerCover()}
                    fallback={
                      <div class="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary via-muted to-secondary/60 text-muted-foreground">
                        <ImagePlus class="size-8 opacity-70" />
                        <span class="px-3 text-center text-xs">
                          {t("playlist.form.chooseImage")}
                        </span>
                      </div>
                    }
                  >
                    <Cover
                      coverArtId={props.playlist!.coverArt ?? props.playlist!.id}
                      cacheKey={props.coverKey}
                      size={400}
                      alt={props.playlist!.name}
                      class="size-full"
                      iconClass="size-10"
                    />
                  </Show>
                }
              >
                <img
                  src={preview()!}
                  alt=""
                  draggable={false}
                  class="size-full object-cover"
                />
              </Show>
              <Show when={hasCover()}>
                <span class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <ImagePlus class="size-6" />
                  {t("playlist.form.changeImage")}
                </span>
              </Show>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={COVER_IMAGE_TYPES.join(",")}
              class="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void pickFile(file);
              }}
            />
            <Show when={preview() || (editing() && image() === undefined)}>
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                onClick={removeImage}
                disabled={saving()}
              >
                <Trash2 class="size-3.5" />
                {t(preview() ? "playlist.form.discardImage" : "playlist.form.removeImage")}
              </button>
            </Show>
            <Show when={editing() && image() === null}>
              <p class="max-w-40 text-center text-xs text-muted-foreground">
                {t("playlist.form.imageRemoved")}
              </p>
            </Show>
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-4">
            <div class="space-y-1.5">
              <Label for="playlist-name">{t("playlist.form.name")}</Label>
              <Input
                id="playlist-name"
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
                placeholder={t("playlist.form.namePlaceholder")}
                maxLength={200}
                autofocus
                disabled={saving()}
              />
            </div>
            <div class="space-y-1.5">
              <Label for="playlist-comment">{t("playlist.form.comment")}</Label>
              <textarea
                id="playlist-comment"
                value={comment()}
                onInput={(event) => setComment(event.currentTarget.value)}
                placeholder={t("playlist.form.commentPlaceholder")}
                rows={3}
                maxLength={1000}
                disabled={saving()}
                class="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CheckboxField
              checked={isPublic()}
              onChange={setIsPublic}
              label={t("playlist.form.public")}
              description={t("playlist.form.publicHint")}
              disabled={saving()}
            />
            <Show when={error()}>
              <FieldError>{error()}</FieldError>
            </Show>
            <DialogFooter class="mt-auto">
              <Button
                variant="ghost"
                onClick={() => props.onOpenChange(false)}
                disabled={saving()}
              >
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={saving() || !name().trim()}>
                <Show when={saving()}>
                  <Spinner class="size-4 border-primary-foreground/30 border-t-primary-foreground" />
                </Show>
                {saving()
                  ? t("action.saving")
                  : t(editing() ? "action.save" : "playlist.form.create")}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddToPlaylistDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songCount: number;
  playlists: Playlist[];
  loading: boolean;
  coverKey: (id: string) => number;
  onPick: (playlist: Playlist) => Promise<void>;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = createSignal("");
  const [busyId, setBusyId] = createSignal<string | null>(null);

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          setQuery("");
          setBusyId(null);
        }
      },
    ),
  );

  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase();
    if (!needle) return props.playlists;
    return props.playlists.filter((playlist) =>
      playlist.name.toLowerCase().includes(needle),
    );
  });

  async function pick(playlist: Playlist) {
    if (busyId()) return;
    setBusyId(playlist.id);
    try {
      await props.onPick(playlist);
      props.onOpenChange(false);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("playlist.addTo.title")}</DialogTitle>
          <DialogDescription>
            {t("playlist.addTo.description", { count: props.songCount })}
          </DialogDescription>
        </DialogHeader>

        <div class="relative">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("playlist.addTo.filter")}
            class="pl-8"
          />
        </div>

        <div class="-mx-2 mt-3 max-h-[50vh] overflow-y-auto">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => props.onCreateNew()}
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-secondary/50 text-muted-foreground">
              <Plus class="size-4" />
            </span>
            {t("playlists.create")}
          </button>

          <Show
            when={!props.loading}
            fallback={
              <div class="flex justify-center py-6">
                <Spinner />
              </div>
            }
          >
            <For
              each={filtered()}
              fallback={
                <p class="flex items-center justify-center gap-2 px-2 py-6 text-xs text-muted-foreground">
                  <ListMusic class="size-4" />
                  {t(query() ? "playlist.addTo.noMatch" : "playlist.addTo.none")}
                </p>
              }
            >
              {(playlist) => (
                <button
                  type="button"
                  class={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:opacity-60",
                    busyId() === playlist.id && "bg-accent",
                  )}
                  disabled={Boolean(busyId())}
                  onClick={() => void pick(playlist)}
                >
                  <Cover
                    coverArtId={playlist.coverArt ?? playlist.id}
                    cacheKey={props.coverKey(playlist.id)}
                    size={80}
                    alt={playlist.name}
                    class="size-10 rounded-md"
                    iconClass="size-4"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">
                      {playlist.name}
                    </span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {t("playlist.songCount", { count: playlist.songCount ?? 0 })}
                    </span>
                  </span>
                  <Show when={busyId() === playlist.id}>
                    <Spinner class="size-4" />
                  </Show>
                </button>
              )}
            </For>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePlaylistDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: Playlist | null;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = createSignal(false);

  async function confirm() {
    setBusy(true);
    try {
      await props.onConfirm();
      props.onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => !busy() && props.onOpenChange(open)}>
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("playlist.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("playlist.delete.description", { name: props.playlist?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => props.onOpenChange(false)}
            disabled={busy()}
          >
            {t("action.cancel")}
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy()}>
            <Trash2 class="size-4" />
            {t("action.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
