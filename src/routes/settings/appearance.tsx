import { For } from "solid-js";
import { locale, setLocale, t, type MessageKey, type Locale } from "~/i18n";
import {
  font,
  setFont,
  setTheme,
  theme,
  type Font,
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
