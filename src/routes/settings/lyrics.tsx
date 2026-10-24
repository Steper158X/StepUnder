import { t } from "~/i18n";
import {
  lyricsBlur,
  lyricsBlurSmooth,
  lyricsLineMarker,
  phoneticLyrics,
  setLyricsLineMarker,
  setLyricsBlur,
  setLyricsBlurSmooth,
  setPhoneticLyrics,
  setSideLyrics,
  sideLyrics,
  type LyricsBlur,
} from "~/state/settings";
import { Switch } from "~/components/ui/switch";
import { Select } from "~/components/ui/select";
import { Row, SettingsSubPage } from "./shared";

const blurOptions: LyricsBlur[] = ["off", "soft", "strong"];

export default function LyricsSettingsPage() {
  return (
    <SettingsSubPage title={t("settings.lyrics")}>
      <Row
        label={t("settings.sideLyrics")}
        description={t("settings.sideLyricsHint")}
      >
        <Switch
          checked={sideLyrics()}
          onChange={setSideLyrics}
          label={t("settings.sideLyrics")}
        />
      </Row>

      <Row
        label={t("settings.phoneticLyrics")}
        description={t("settings.phoneticLyricsHint")}
      >
        <Switch
          checked={phoneticLyrics()}
          onChange={setPhoneticLyrics}
          label={t("settings.phoneticLyrics")}
        />
      </Row>

      <Row
        label={t("settings.lyricsLineMarker")}
        description={t("settings.lyricsLineMarkerHint")}
      >
        <Switch
          checked={lyricsLineMarker()}
          onChange={setLyricsLineMarker}
          label={t("settings.lyricsLineMarker")}
        />
      </Row>

      <Row
        label={t("settings.lyricsBlur")}
        description={t("settings.lyricsBlurHint")}
      >
        <div class="w-44">
          <Select
            aria-label={t("settings.lyricsBlur")}
            value={lyricsBlur()}
            options={blurOptions.map((value) => ({
              value,
              label: t(`settings.lyricsBlur.${value}`),
            }))}
            onChange={(value) => setLyricsBlur(value as LyricsBlur)}
          />
        </div>
      </Row>

      <Row
        label={t("settings.lyricsBlurSmooth")}
        description={t("settings.lyricsBlurSmoothHint")}
      >
        <Switch
          checked={lyricsBlurSmooth()}
          onChange={setLyricsBlurSmooth}
          disabled={lyricsBlur() === "off"}
          label={t("settings.lyricsBlurSmooth")}
        />
      </Row>
    </SettingsSubPage>
  );
}
