import { t } from "~/i18n";
import {
  lyricsBlur,
  lyricsBlurSmooth,
  phoneticLyrics,
  setLyricsBlur,
  setLyricsBlurSmooth,
  setPhoneticLyrics,
  type LyricsBlur,
} from "~/state/settings";
import { CheckboxField } from "~/components/ui/checkbox";
import { Select } from "~/components/ui/select";
import { Row, SettingsSubPage } from "./shared";

const blurOptions: LyricsBlur[] = ["off", "soft", "strong"];

export default function LyricsSettingsPage() {
  return (
    <SettingsSubPage title={t("settings.lyrics")}>
      <Row
        label={t("settings.phoneticLyrics")}
        description={t("settings.phoneticLyricsHint")}
      >
        <CheckboxField
          checked={phoneticLyrics()}
          onChange={setPhoneticLyrics}
          label=""
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
        <CheckboxField
          checked={lyricsBlurSmooth()}
          onChange={setLyricsBlurSmooth}
          disabled={lyricsBlur() === "off"}
          label=""
        />
      </Row>
    </SettingsSubPage>
  );
}
