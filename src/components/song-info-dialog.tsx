import { For, Show, createResource } from "solid-js";
import type { Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import { locale, t, type MessageKey } from "~/i18n";
import { formatBytes, formatTime } from "~/lib/format";
import { Cover } from "~/components/common";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type RawSong = Song & Record<string, any>;

interface InfoRow {
  label: string;
  value: string;
}

function names(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean)
    .join(", ");
}

function formatDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale() === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function text(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

/** Fields shown with their own label; everything else lands in "More details". */
const KNOWN_KEYS = new Set([
  "id",
  "title",
  "artist",
  "artists",
  "displayArtist",
  "album",
  "albumArtists",
  "displayAlbumArtist",
  "track",
  "discNumber",
  "year",
  "genre",
  "genres",
  "duration",
  "suffix",
  "contentType",
  "bitRate",
  "samplingRate",
  "bitDepth",
  "channelCount",
  "size",
  "bpm",
  "playCount",
  "played",
  "created",
  "path",
  "comment",
  // Internal ids and flags with no meaning to the listener.
  "coverArt",
  "albumId",
  "artistId",
  "parent",
  "isDir",
  "isVideo",
  "type",
  "mediaType",
  "starred",
]);

function knownRows(song: RawSong): InfoRow[] {
  const row = (key: MessageKey, value: string): InfoRow => ({
    label: t(key),
    value,
  });
  const format = [song.suffix?.toUpperCase(), song.contentType]
    .filter(Boolean)
    .join(" · ");
  const disc = song.discNumber ? String(song.discNumber) : "";
  return [
    row("info.title", text(song.title)),
    row("info.artist", text(song.displayArtist) || names(song.artists) || text(song.artist)),
    row("info.album", text(song.album)),
    row("info.albumArtist", text(song.displayAlbumArtist) || names(song.albumArtists)),
    row("info.track", text(song.track)),
    row("info.disc", disc),
    row("info.year", song.year ? String(song.year) : ""),
    row("info.genre", names(song.genres) || text(song.genre)),
    row("info.duration", song.duration ? formatTime(song.duration) : ""),
    row("info.format", format),
    row("info.bitRate", song.bitRate ? `${song.bitRate} kbps` : ""),
    row(
      "info.sampleRate",
      song.samplingRate ? `${(song.samplingRate / 1000).toFixed(1)} kHz` : "",
    ),
    row("info.bitDepth", song.bitDepth ? `${song.bitDepth}-bit` : ""),
    row("info.channels", text(song.channelCount)),
    row("info.size", formatBytes(song.size)),
    row("info.bpm", song.bpm ? String(song.bpm) : ""),
    row("info.playCount", text(song.playCount ?? 0)),
    row("info.lastPlayed", formatDateTime(song.played)),
    row("info.added", formatDateTime(song.created)),
    row("info.comment", text(song.comment)),
    row("info.path", text(song.path)),
    row("info.id", text(song.id)),
  ].filter((item) => item.value);
}

/** Any other field the server sent, flattened one level deep. */
function extraRows(song: RawSong): InfoRow[] {
  const rows: InfoRow[] = [];
  for (const [key, value] of Object.entries(song)) {
    if (KNOWN_KEYS.has(key) || value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const joined = names(value);
      if (joined) rows.push({ label: key, value: joined });
    } else if (typeof value === "object") {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (innerValue !== null && typeof innerValue !== "object") {
          rows.push({ label: `${key}.${inner}`, value: String(innerValue) });
        }
      }
    } else if (value !== "") {
      rows.push({ label: key, value: String(value) });
    }
  }
  return rows;
}

function InfoList(props: { rows: InfoRow[] }) {
  return (
    <dl class="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      <For each={props.rows}>
        {(item) => (
          <>
            <dt class="text-muted-foreground">{item.label}</dt>
            <dd class="select-text break-words">{item.value}</dd>
          </>
        )}
      </For>
    </dl>
  );
}

export function SongInfoDialog(props: {
  song: Song;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const servers = useServers();

  // List rows only carry what their endpoint returned; getSong has every field.
  const [full] = createResource(
    () => (props.open ? props.song.id : null),
    async (id) => {
      const client = servers.client();
      if (!client) return props.song as RawSong;
      return client.getSong(id).catch(() => props.song as RawSong);
    },
  );

  const song = (): RawSong => (full() ?? props.song) as RawSong;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-lg">
        <DialogHeader class="flex flex-row items-center gap-3 space-y-0">
          <Cover
            coverArtId={song().coverArt}
            size={128}
            alt={song().album ?? song().title}
            class="size-16 shrink-0 rounded-md"
          />
          <div class="min-w-0 space-y-1">
            <DialogTitle class="truncate">{song().title}</DialogTitle>
            <DialogDescription class="truncate">
              {song().artist ?? t("common.unknownArtist")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div class="-mr-2 max-h-[60vh] space-y-4 overflow-y-auto pr-2">
          <InfoList rows={knownRows(song())} />
          <Show when={extraRows(song()).length}>
            <div class="space-y-2 border-t pt-3">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("info.more")}
              </p>
              <InfoList rows={extraRows(song())} />
            </div>
          </Show>
          <Show when={full.loading}>
            <p class="text-xs text-muted-foreground">{t("common.loading")}</p>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  );
}
