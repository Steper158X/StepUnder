import { Show } from "solid-js";
import { Download, ExternalLink, RefreshCw } from "lucide-solid";
import { openUrl } from "@tauri-apps/plugin-opener";
import { t } from "~/i18n";
import { autoUpdate, setAutoUpdate } from "~/state/settings";
import { isTauri } from "~/lib/platform";
import {
  appVersion,
  available as availableUpdate,
  checkForUpdates,
  error as updateError,
  installUpdate,
  isBusy as updateBusy,
  progressPercent,
  status as updateStatus,
} from "~/lib/updater";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/select";
import { CheckboxField } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { Row, SettingsSubPage } from "./shared";

const REPO_URL = "https://github.com/Steper158X/StepUnder";

function openRepo() {
  if (isTauri) void openUrl(REPO_URL);
  else window.open(REPO_URL, "_blank", "noopener");
}

export default function AboutSettingsPage() {
  const updateDescription = () => {
    switch (updateStatus()) {
      case "checking":
        return t("settings.checkingUpdate");
      case "available":
        return t("settings.updateAvailable", {
          version: availableUpdate()?.version ?? "",
        });
      case "up-to-date":
        return t("settings.updateUpToDate");
      case "downloading": {
        const percent = progressPercent();
        return percent === null
          ? t("settings.updateProgressUnknown")
          : t("settings.updateDownloading", { percent: `${percent}%` });
      }
      case "installing":
        return t("settings.updateInstalling");
      case "error":
        return [t("settings.updateError"), updateError()]
          .filter(Boolean)
          .join(" ");
      default:
        return isTauri
          ? t("settings.autoUpdateHint")
          : t("settings.updateDesktopOnly");
    }
  };

  return (
    <SettingsSubPage title={t("settings.about")}>
      <p class="py-3.5 text-sm text-muted-foreground">
        {t("settings.aboutHint")}
      </p>

      <Row label="GitHub" description="github.com/Steper158X/StepUnder">
        <Button variant="outline" size="sm" onClick={openRepo}>
          <ExternalLink class="size-3.5" />
          {t("settings.openGithub")}
        </Button>
      </Row>

      <Row label={t("settings.version")} description={updateDescription()}>
        <div class="flex items-center gap-2">
          <Badge>v{appVersion()}</Badge>
          <Show when={updateStatus() === "available"}>
            <Button size="sm" onClick={() => void installUpdate()}>
              <Download class="size-3.5" />
              {t("settings.updateNow")}
            </Button>
          </Show>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !isTauri || updateBusy() || updateStatus() === "available"
            }
            onClick={() => void checkForUpdates()}
          >
            <RefreshCw
              class={cn(
                "size-3.5",
                updateStatus() === "checking" && "animate-spin",
              )}
            />
            {t("settings.checkUpdate")}
          </Button>
        </div>
      </Row>

      <Show
        when={
          updateStatus() === "downloading" || updateStatus() === "installing"
        }
      >
        <div class="py-3">
          <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              class={cn(
                "h-full rounded-full bg-primary transition-[width] duration-200",
                progressPercent() === null && "animate-pulse",
              )}
              style={{ width: `${progressPercent() ?? 100}%` }}
            />
          </div>
          <p class="mt-1.5 text-xs text-muted-foreground">
            {updateDescription()}
          </p>
        </div>
      </Show>

      <Row
        label={t("settings.autoUpdate")}
        description={t("settings.autoUpdateHint")}
      >
        <CheckboxField
          checked={autoUpdate()}
          onChange={setAutoUpdate}
          label=""
          disabled={!isTauri}
        />
      </Row>
    </SettingsSubPage>
  );
}
