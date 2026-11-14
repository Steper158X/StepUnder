import { Languages } from "lucide-solid";
import { LOCALE_OPTIONS, locale, setLocale, t, type Locale } from "~/i18n";
import { Select } from "~/components/ui/select";
import { cn } from "~/lib/utils";

export function LanguageSwitcher(props: {
  class?: string;
  selectClass?: string;
  showIcon?: boolean;
}) {
  return (
    <div class={cn("flex items-center gap-2", props.class)}>
      {props.showIcon && (
        <Languages class="size-4 shrink-0 text-muted-foreground" />
      )}
      <Select
        class={cn("w-36", props.selectClass)}
        aria-label={t("settings.language")}
        value={locale()}
        options={LOCALE_OPTIONS}
        onChange={(value) => setLocale(value as Locale)}
      />
    </div>
  );
}
