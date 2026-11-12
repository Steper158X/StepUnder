import { For, Show, createMemo, createSignal } from "solid-js";
import { Popover } from "@kobalte/core/popover";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-solid";
import { locale, t } from "~/i18n";
import { cn } from "~/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (value: number) => String(value).padStart(2, "0");

const intlLocale = () => (locale() === "th" ? "th-TH" : "en-US");

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Centers the selected row of a scroll list without scrolling the page. */
function centerSelected(list: HTMLElement | undefined) {
  const item = list?.querySelector<HTMLElement>("[data-selected]");
  if (!list || !item) return;
  list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
}

/** Date + time picker drawn by the app instead of the browser's native one. */
export function DateTimePicker(props: {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Earlier days are disabled and earlier times are clamped up to this. */
  min?: Date;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = createSignal(false);
  const [view, setView] = createSignal(new Date());
  let hourList: HTMLDivElement | undefined;
  let minuteList: HTMLDivElement | undefined;

  function openChange(next: boolean) {
    if (next) {
      const base = props.value ?? new Date();
      setView(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setOpen(next);
  }

  function emit(next: Date) {
    props.onChange(props.min && next < props.min ? new Date(props.min) : next);
  }

  /** Changes one part of the value, starting from now when it is empty. */
  function update(part: { date?: Date; hour?: number; minute?: number }) {
    const base = props.value ?? new Date();
    const day = part.date ?? base;
    emit(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        part.hour ?? base.getHours(),
        part.minute ?? base.getMinutes(),
      ),
    );
  }

  const label = () =>
    props.value
      ? new Intl.DateTimeFormat(intlLocale(), {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(props.value)
      : "";

  const monthLabel = () =>
    new Intl.DateTimeFormat(intlLocale(), {
      month: "long",
      year: "numeric",
    }).format(view());

  const weekdays = createMemo(() => {
    const format = new Intl.DateTimeFormat(intlLocale(), { weekday: "narrow" });
    // 2024-01-07 is a Sunday.
    return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 7 + i)));
  });

  const days = createMemo(() => {
    const first = view();
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from(
      { length: 42 },
      (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    );
  });

  const canGoBack = () => {
    if (!props.min) return true;
    const min = props.min;
    const current = view();
    return (
      current.getFullYear() > min.getFullYear() ||
      (current.getFullYear() === min.getFullYear() && current.getMonth() > min.getMonth())
    );
  };

  function shiftMonth(delta: number) {
    const current = view();
    setView(new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <Popover
      open={open()}
      onOpenChange={openChange}
      placement="bottom-start"
      gutter={6}
    >
      <div class="relative">
        <Popover.Trigger
          id={props.id}
          disabled={props.disabled}
          class={cn(
            "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            open() && "ring-1 ring-ring",
            props.value ? "pr-16" : "pr-9",
          )}
        >
          <span class={cn("truncate", !props.value && "text-muted-foreground")}>
            {props.value ? label() : props.placeholder}
          </span>
        </Popover.Trigger>
        <Show when={props.value && !props.disabled}>
          <button
            type="button"
            class="absolute right-9 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => props.onChange(null)}
            aria-label={t("action.clear")}
          >
            <X class="size-3.5" />
          </button>
        </Show>
        <CalendarDays class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      <Popover.Portal>
        <Popover.Content
          class="glass-popover z-[110] flex overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl outline-none animate-fade-in"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => {
              centerSelected(hourList);
              centerSelected(minuteList);
            });
          }}
        >
          <div class="w-64 p-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium">{monthLabel()}</span>
              <div class="flex gap-0.5">
                <button
                  type="button"
                  class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  onClick={() => shiftMonth(-1)}
                  disabled={!canGoBack()}
                  aria-label={t("picker.previousMonth")}
                >
                  <ChevronLeft class="size-4" />
                </button>
                <button
                  type="button"
                  class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => shiftMonth(1)}
                  aria-label={t("picker.nextMonth")}
                >
                  <ChevronRight class="size-4" />
                </button>
              </div>
            </div>

            <div class="grid grid-cols-7 gap-0.5 text-center">
              <For each={weekdays()}>
                {(day) => (
                  <span class="py-1 text-[11px] font-medium text-muted-foreground">
                    {day}
                  </span>
                )}
              </For>
              <For each={days()}>
                {(day) => {
                  const selected = () => Boolean(props.value && sameDay(day, props.value));
                  const today = sameDay(day, new Date());
                  const outside = day.getMonth() !== view().getMonth();
                  const disabled = Boolean(props.min && endOfDay(day) < props.min);
                  return (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => update({ date: day })}
                      class={cn(
                        "flex h-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-25",
                        outside && "text-muted-foreground/60",
                        today && !selected() && "font-semibold text-primary",
                        selected() &&
                          "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                }}
              </For>
            </div>

            <div class="mt-2 flex justify-between border-t pt-2">
              <button
                type="button"
                class="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => props.onChange(null)}
              >
                {t("action.clear")}
              </button>
              <button
                type="button"
                class="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                onClick={() => setOpen(false)}
              >
                {t("picker.done")}
              </button>
            </div>
          </div>

          <div class="flex border-l">
            <TimeColumn
              ref={(element) => (hourList = element)}
              items={HOURS}
              selected={props.value?.getHours()}
              onPick={(hour) => update({ hour })}
              label={t("picker.hour")}
            />
            <TimeColumn
              ref={(element) => (minuteList = element)}
              items={MINUTES}
              selected={props.value?.getMinutes()}
              onPick={(minute) => update({ minute })}
              label={t("picker.minute")}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

function TimeColumn(props: {
  ref: (element: HTMLDivElement) => void;
  items: number[];
  selected?: number;
  onPick: (value: number) => void;
  label: string;
}) {
  return (
    <div class="flex w-14 flex-col">
      <span class="border-b py-2 text-center text-[11px] font-medium text-muted-foreground">
        {props.label}
      </span>
      <div
        ref={props.ref}
        class="relative h-[17rem] overflow-y-auto no-scrollbar overscroll-contain p-1"
      >
        <For each={props.items}>
          {(item) => (
            <button
              type="button"
              data-selected={props.selected === item ? "" : undefined}
              onClick={() => props.onPick(item)}
              class={cn(
                "flex h-8 w-full items-center justify-center rounded-md text-xs tabular-nums transition-colors hover:bg-accent",
                props.selected === item &&
                  "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {pad(item)}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
