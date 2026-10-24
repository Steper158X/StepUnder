import { t } from "~/i18n";
import { phoneticLyrics, setPhoneticLyrics } from "~/state/settings";
import { CheckboxField } from "~/components/ui/checkbox";
import { Row, SettingsSubPage } from "./shared";

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
    </SettingsSubPage>
  );
}
