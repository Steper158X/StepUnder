import { For, Match, Show, Switch, type JSX } from "solid-js";
import { Download, LoaderCircle } from "lucide-solid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import {
  available,
  dismissPrompt,
  error,
  installUpdate,
  progressPercent,
  promptOpen,
  status,
} from "~/lib/updater";

type NoteBlock =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

/**
 * Splits release notes (GitHub Markdown) into headings, bullet lists and
 * paragraphs. Single line breaks inside a paragraph are soft, as in Markdown.
 */
function parseNotes(source: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
    if (list) {
      blocks.push({ kind: "list", items: list });
      list = null;
    }
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const item = /^[-*+]\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (item) {
      if (paragraph.length) flush();
      (list ??= []).push(item[1]);
    } else if (list) {
      // Continuation of the previous bullet.
      list[list.length - 1] += ` ${line}`;
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Inline Markdown: **bold**, *italic* / _italic_, `code`, [text](url). */
function renderInline(text: string): JSX.Element[] {
  const pattern =
    /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\[([^\]]+)\]\([^)]*\)|\*([^*\s][^*]*?)\*|\b_([^_]+)_\b/g;
  const nodes: JSX.Element[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const [, bold, boldAlt, code, link, italic, italicAlt] = match;
    if (bold ?? boldAlt) {
      nodes.push(<strong class="font-semibold">{renderInline(bold ?? boldAlt)}</strong>);
    } else if (code) {
      nodes.push(
        <code class="rounded bg-secondary px-1 py-0.5 font-mono text-[0.95em]">
          {code}
        </code>,
      );
    } else if (link) {
      nodes.push(<span class="font-medium">{renderInline(link)}</span>);
    } else {
      nodes.push(<em>{renderInline(italic ?? italicAlt)}</em>);
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function ReleaseNotes(props: { source: string }) {
  return (
    <div class="space-y-2">
      <For each={parseNotes(props.source)}>
        {(block) => (
          <Switch>
            <Match when={block.kind === "heading" && block}>
              {(heading) => (
                <p class="font-semibold text-foreground">
                  {renderInline(heading().text)}
                </p>
              )}
            </Match>
            <Match when={block.kind === "list" && block}>
              {(list) => (
                <ul class="list-disc space-y-0.5 pl-4">
                  <For each={list().items}>
                    {(item) => <li>{renderInline(item)}</li>}
                  </For>
                </ul>
              )}
            </Match>
            <Match when={block.kind === "paragraph" && block}>
              {(paragraph) => <p>{renderInline(paragraph().text)}</p>}
            </Match>
          </Switch>
        )}
      </For>
    </div>
  );
}

/** Modal shown when the startup/manual check finds a newer release. */
export function UpdatePrompt() {
  const busy = () =>
    status() === "downloading" || status() === "installing";
  const percentLabel = () => {
    const value = progressPercent();
    return value === null ? null : `${value}%`;
  };

  const openChange = (open: boolean) => {
    if (!open && !busy()) dismissPrompt();
  };

  return (
    <Dialog open={promptOpen()} onOpenChange={openChange}>
      <DialogContent class="max-w-lg" showClose={!busy()}>
        <DialogHeader>
          <DialogTitle>{t("update.title")}</DialogTitle>
          <DialogDescription>
            {t("update.description", {
              version: available()?.version ?? "",
              current: available()?.currentVersion ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <Show when={available()?.notes?.trim()}>
          <div class="mb-1">
            <p class="mb-1.5 text-xs font-medium text-muted-foreground">
              {t("update.notes")}
            </p>
            <div class="max-h-44 overflow-y-auto rounded-md border border-border/70 bg-secondary/40 p-3 text-xs leading-relaxed">
              <ReleaseNotes source={available()?.notes ?? ""} />
            </div>
          </div>
        </Show>

        <Show when={busy()}>
          <div class="mt-2">
            <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                class={cn(
                  "h-full rounded-full bg-primary transition-[width] duration-200",
                  percentLabel() === null && "animate-pulse",
                )}
                style={{ width: `${progressPercent() ?? 100}%` }}
              />
            </div>
            <p class="mt-1.5 text-xs text-muted-foreground">
              {status() === "installing"
                ? t("update.installing")
                : percentLabel()
                  ? t("update.downloading", { percent: percentLabel()! })
                  : t("update.downloading", { percent: "" })}
            </p>
          </div>
        </Show>

        <Show when={status() === "error" && error()}>
          <p class="mt-2 text-xs text-destructive">
            {t("update.error")} {error()}
          </p>
        </Show>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy()}
            onClick={dismissPrompt}
          >
            {t("update.later")}
          </Button>
          <Button disabled={busy()} onClick={() => void installUpdate()}>
            <Show
              when={busy()}
              fallback={<Download class="size-4" />}
            >
              <LoaderCircle class="size-4 animate-spin" />
            </Show>
            {t("update.install")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
