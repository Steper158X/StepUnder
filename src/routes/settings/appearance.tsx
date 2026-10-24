import { For, Show } from "solid-js";
import { locale, setLocale, t, type MessageKey, type Locale } from "~/i18n";
import { Check, PanelBottom, RectangleHorizontal } from "lucide-solid";
import {
  ACCENT_HUES,
  accent,
  font,
  playerLayout,
  setAccent,
  setFont,
  setPlayerLayout,
  setTheme,
  theme,
  type Accent,
  type Font,
  type PlayerLayout,
  type Theme,
} from "~/state/settings";
import { Select } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { Row, SettingsSubPage } from "./shared";

const themeOptions: Array<{ value: Theme; key: MessageKey }> = [
  { value: "dark", key: "settings.theme.dark" },
  { value: "light", key: "settings.theme.light" },
  { value: "system", key: "settings.theme.system" },
];

const accentOptions: Array<{ value: Accent; key: MessageKey }> = [
  { value: "purple", key: "settings.accent.purple" },
  { value: "blue", key: "settings.accent.blue" },
  { value: "teal", key: "settings.accent.teal" },
  { value: "green", key: "settings.accent.green" },
  { value: "orange", key: "settings.accent.orange" },
  { value: "red", key: "settings.accent.red" },
  { value: "pink", key: "settings.accent.pink" },
];

const playerLayoutOptions: Array<{
  value: PlayerLayout;
  key: MessageKey;
  icon: typeof PanelBottom;
}> = [
  { value: "docked", key: "settings.playerLayout.docked", icon: PanelBottom },
  {
    value: "floating",
    key: "settings.playerLayout.floating",
    icon: RectangleHorizontal,
  },
];

const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];

const fontOptions: Array<{ value: Font; key: MessageKey }> = [
  { value: "system", key: "settings.font.system" },
  { value: "sarabun", key: "settings.font.sarabun" },
];

export default function AppearanceSettingsPage() {
  return (
    <SettingsSubPage title={t("settings.appearance")}>
      <Row label={t("settings.theme")}>
        <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
          <For each={themeOptions}>
            {(option) => (
              <button
                type="button"
                onClick={() => setTheme(option.value)}
                class={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  theme() === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(option.key)}
              </button>
            )}
          </For>
        </div>
      </Row>

      <Row label={t("settings.accent")}>
        <div class="flex flex-wrap gap-2">
          <For each={accentOptions}>
            {(option) => (
              <button
                type="button"
                title={t(option.key)}
                aria-label={t(option.key)}
                aria-pressed={accent() === option.value}
                onClick={() => setAccent(option.value)}
                class={cn(
                  "flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-card transition-shadow",
                  accent() === option.value
                    ? "ring-2 ring-foreground/70"
                    : "hover:ring-2 hover:ring-border",
                )}
                style={{
                  "background-color": `oklch(0.6 0.2 ${ACCENT_HUES[option.value]})`,
                }}
              >
                <Show when={accent() === option.value}>
                  <Check class="size-3.5" stroke-width={3} />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Row>

      <Row label={t("settings.font")} description={t("settings.fontHint")}>
        <div class="w-44">
          <Select
            aria-label={t("settings.font")}
            value={font()}
            options={fontOptions.map((option) => ({
              value: option.value,
              label: t(option.key),
            }))}
            onChange={(value) => setFont(value as Font)}
          />
        </div>
      </Row>

      <Row
        label={t("settings.playerLayout")}
        description={t("settings.playerLayoutHint")}
      >
        <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
          <For each={playerLayoutOptions}>
            {(option) => (
              <button
                type="button"
                onClick={() => setPlayerLayout(option.value)}
                class={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  playerLayout() === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon class="size-3.5" />
                {t(option.key)}
              </button>
            )}
          </For>
        </div>
      </Row>

      <Row label={t("settings.language")}>
        <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
          <For each={localeOptions}>
            {(option) => (
              <button
                type="button"
                onClick={() => setLocale(option.value)}
                class={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  locale() === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </Row>
    </SettingsSubPage>
  );
}
