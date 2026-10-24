import { For, Show } from "solid-js";
import { locale, setLocale, t, type MessageKey, type Locale } from "~/i18n";
import {
  Check,
  Droplet,
  PanelBottom,
  RectangleHorizontal,
  Square,
} from "lucide-solid";
import {
  ACCENT_HUES,
  DEFAULT_GLASS_BLUR,
  DEFAULT_GLASS_BRIGHTNESS,
  DEFAULT_GLASS_BRIGHTNESS_LIGHT,
  DEFAULT_WINDOW_OPACITY,
  MAX_GLASS_BLUR,
  accent,
  darkActive,
  font,
  glassBlur,
  glassBrightness,
  glassBrightnessLight,
  playerLayout,
  setAccent,
  setFont,
  setGlassBlur,
  setGlassBrightness,
  setPlayerLayout,
  setTheme,
  setUiStyle,
  setWindowEffect,
  setWindowOpacity,
  theme,
  uiStyle,
  windowEffect,
  windowOpacity,
  type Accent,
  type Font,
  type PlayerLayout,
  type Theme,
  type UiStyle,
  type WindowEffect,
} from "~/state/settings";
import { isTauri } from "~/lib/platform";
import { Select } from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { cn } from "~/lib/utils";
import { Row, SettingsSection, SettingsSubPage } from "./shared";

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

const uiStyleOptions: Array<{
  value: UiStyle;
  key: MessageKey;
  icon: typeof Square;
}> = [
  { value: "standard", key: "settings.uiStyle.standard", icon: Square },
  { value: "glass", key: "settings.uiStyle.glass", icon: Droplet },
];

const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];

const fontOptions: Array<{ value: Font; key: MessageKey }> = [
  { value: "system", key: "settings.font.system" },
  { value: "sarabun", key: "settings.font.sarabun" },
];

const windowEffectOptions: Array<{ value: WindowEffect; key: MessageKey }> = [
  { value: "none", key: "settings.windowEffect.none" },
  { value: "acrylic", key: "settings.windowEffect.acrylic" },
  { value: "mica", key: "settings.windowEffect.mica" },
];

/** Slider with its value and a reset link; saves once the drag ends. */
function SliderRow(props: {
  label: string;
  description: string;
  value: number;
  max: number;
  defaultValue: number;
  onChange: (value: number, save?: boolean) => void;
}) {
  return (
    <Row label={props.label} description={props.description}>
      <div class="flex w-56 items-center gap-3">
        <Slider
          value={props.value}
          max={props.max}
          step={1}
          class="flex-1"
          ariaLabel={props.label}
          onValueChange={(value) => props.onChange(value, false)}
          onValueCommit={(value) => props.onChange(value)}
        />
        <span class="w-8 text-right text-xs tabular-nums text-muted-foreground">
          {props.value}
        </span>
        <button
          type="button"
          disabled={props.value === props.defaultValue}
          onClick={() => props.onChange(props.defaultValue)}
          class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {t("settings.reset")}
        </button>
      </div>
    </Row>
  );
}

export default function AppearanceSettingsPage() {
  return (
    <SettingsSubPage
      title={t("settings.appearance")}
      sections={
        <Show when={uiStyle() === "glass"}>
          <SettingsSection
            title={t("settings.uiStyle.glass")}
            icon={<Droplet class="size-4" />}
          >
            <SliderRow
              label={t("settings.glassBrightness")}
              description={t(
                darkActive()
                  ? "settings.glassBrightnessHint"
                  : "settings.glassBrightnessHintLight",
              )}
              value={darkActive() ? glassBrightness() : glassBrightnessLight()}
              max={100}
              defaultValue={
                darkActive()
                  ? DEFAULT_GLASS_BRIGHTNESS
                  : DEFAULT_GLASS_BRIGHTNESS_LIGHT
              }
              onChange={setGlassBrightness}
            />

            <SliderRow
              label={t("settings.glassBlur")}
              description={t("settings.glassBlurHint")}
              value={glassBlur()}
              max={MAX_GLASS_BLUR}
              defaultValue={DEFAULT_GLASS_BLUR}
              onChange={setGlassBlur}
            />

            <Show when={isTauri}>
              <Row
                label={t("settings.windowEffect")}
                description={t("settings.windowEffectHint")}
              >
                <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
                  <For each={windowEffectOptions}>
                    {(option) => (
                      <button
                        type="button"
                        onClick={() => setWindowEffect(option.value)}
                        class={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          windowEffect() === option.value
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

              <Show when={windowEffect() !== "none"}>
                <SliderRow
                  label={t("settings.windowOpacity")}
                  description={t("settings.windowOpacityHint")}
                  value={windowOpacity()}
                  max={100}
                  defaultValue={DEFAULT_WINDOW_OPACITY}
                  onChange={setWindowOpacity}
                />
              </Show>
            </Show>
          </SettingsSection>
        </Show>
      }
    >
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

      <Row label={t("settings.uiStyle")} description={t("settings.uiStyleHint")}>
        <div class="flex gap-1 rounded-lg border border-border/70 p-0.5">
          <For each={uiStyleOptions}>
            {(option) => (
              <button
                type="button"
                onClick={() => setUiStyle(option.value)}
                class={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  uiStyle() === option.value
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
