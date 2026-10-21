import { A } from "@solidjs/router";
import { t } from "~/i18n";

export default function NotFoundPage() {
  return (
    <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p class="text-5xl font-bold text-muted-foreground/40">404</p>
      <p class="text-sm text-muted-foreground">{t("common.empty")}</p>
      <A href="/" class="text-sm font-medium text-primary hover:underline">
        {t("nav.home")}
      </A>
    </div>
  );
}
