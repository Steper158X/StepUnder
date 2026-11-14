import { Show, createSignal } from "solid-js";
import { Eye, EyeOff, LoaderCircle } from "lucide-solid";
import type { ServerConfig, ServerInput } from "~/lib/types";
import { SubsonicClient, normalizeServerUrl, subsonicErrorKey } from "~/lib/subsonic";
import { t, type MessageKey } from "~/i18n";
import { toast } from "~/components/toaster";
import { Button } from "~/components/ui/button";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
} from "~/components/ui/input";
import { CheckboxField } from "~/components/ui/checkbox";
import { isMobile } from "~/lib/platform";

/** Phone-sized fields: taller touch targets and 16px text. */
const touchInput = "max-sm:h-12 max-sm:text-base";
/** Phone-sized buttons: full width and easy to hit with a thumb. */
const touchButton = "max-sm:h-12 max-sm:w-full max-sm:text-base";

export interface ServerFormProps {
  initial?: ServerConfig;
  initialPassword?: string;
  submitLabel?: string;
  onSubmit: (input: ServerInput) => Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function ServerForm(props: ServerFormProps) {
  const [name, setName] = createSignal(props.initial?.name ?? "");
  const [url, setUrl] = createSignal(props.initial?.url ?? "");
  const [username, setUsername] = createSignal(props.initial?.username ?? "");
  const [password, setPassword] = createSignal(props.initialPassword ?? "");
  const [savePassword, setSavePassword] = createSignal(
    props.initial?.savePassword ?? true,
  );
  const [showPassword, setShowPassword] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [testing, setTesting] = createSignal(false);

  function normalizeUrlOrError(): string | null {
    if (!url().trim()) {
      setError(t("error.emptyUrl"));
      return null;
    }
    try {
      return normalizeServerUrl(url());
    } catch {
      setError(t("error.invalidUrl"));
      return null;
    }
  }

  function validate(requireName: boolean): boolean {
    setError(null);
    if (requireName && !name().trim()) {
      setError(t("error.required"));
      return false;
    }
    if (!normalizeUrlOrError()) return false;
    if (!username().trim() || !password()) {
      setError(t("error.required"));
      return false;
    }
    return true;
  }

  function values(): ServerInput {
    return {
      name: name().trim(),
      url: normalizeServerUrl(url()),
      username: username().trim(),
      password: password(),
      savePassword: savePassword(),
    };
  }

  async function handleTest() {
    if (!validate(false)) return;
    setTesting(true);
    try {
      const client = new SubsonicClient({
        url: normalizeServerUrl(url()),
        username: username().trim(),
        password: password(),
      });
      await client.ping();
      toast(t("toast.testSuccess"), undefined, "success");
    } catch (err) {
      setError(t(subsonicErrorKey(err) as MessageKey));
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!validate(true)) return;
    setBusy(true);
    try {
      await props.onSubmit(values());
    } catch (err) {
      setError(t(subsonicErrorKey(err) as MessageKey));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div class="space-y-1.5">
        <Label for="server-name">{t("field.serverName")}</Label>
        <Input
          id="server-name"
          // Opening the keyboard on load would cover half a phone screen.
          autofocus={!isMobile}
          class={touchInput}
          enterkeyhint="next"
          value={name()}
          placeholder={t("field.serverNamePlaceholder")}
          onInput={(event) => setName(event.currentTarget.value)}
          autocomplete="off"
        />
        <FieldHint>{t("field.serverNameHint")}</FieldHint>
      </div>

      <div class="space-y-1.5">
        <Label for="server-url">{t("field.url")}</Label>
        <Input
          id="server-url"
          type="url"
          inputmode="url"
          autocapitalize="none"
          enterkeyhint="next"
          class={touchInput}
          value={url()}
          placeholder={t("field.urlPlaceholder")}
          onInput={(event) => setUrl(event.currentTarget.value)}
          autocomplete="off"
          spellcheck={false}
        />
        <FieldHint>{t("field.urlHint")}</FieldHint>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label for="server-username">{t("field.username")}</Label>
          <Input
            id="server-username"
            autocapitalize="none"
            enterkeyhint="next"
            class={touchInput}
            value={username()}
            placeholder={t("field.usernamePlaceholder")}
            onInput={(event) => setUsername(event.currentTarget.value)}
            autocomplete="username"
            spellcheck={false}
          />
        </div>

        <div class="space-y-1.5">
          <Label for="server-password">{t("field.password")}</Label>
          <div class="relative">
            <Input
              id="server-password"
              type={showPassword() ? "text" : "password"}
              value={password()}
              placeholder={t("field.passwordPlaceholder")}
              onInput={(event) => setPassword(event.currentTarget.value)}
              autocomplete="current-password"
              enterkeyhint="go"
              class={`pr-9 ${touchInput} max-sm:pr-12`}
            />
            <button
              type="button"
              class="absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground max-sm:size-10"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={t("field.password")}
            >
              <Show
                when={showPassword()}
                fallback={<Eye class="size-3.5 max-sm:size-5" />}
              >
                <EyeOff class="size-3.5 max-sm:size-5" />
              </Show>
            </button>
          </div>
        </div>
      </div>

      <CheckboxField
        checked={savePassword()}
        onChange={setSavePassword}
        label={t("field.savePassword")}
        description={isMobile ? undefined : t("field.savePasswordHint")}
      />

      <Show when={error()}>
        <FieldError>{error()}</FieldError>
      </Show>

      {/* Phones stack the buttons full width, primary action on top. */}
      <div class="flex flex-wrap items-center justify-end gap-2 pt-1 max-sm:flex-col-reverse max-sm:items-stretch max-sm:gap-3 max-sm:pt-2">
        <Show when={props.onCancel && props.showCancel !== false}>
          <Button
            variant="ghost"
            class={touchButton}
            onClick={() => props.onCancel?.()}
          >
            {t("action.cancel")}
          </Button>
        </Show>
        <Button
          variant="outline"
          class={touchButton}
          disabled={testing() || busy()}
          onClick={() => void handleTest()}
        >
          <Show when={testing()}>
            <LoaderCircle class="size-4 animate-spin" />
          </Show>
          {t("action.testConnection")}
        </Button>
        <Button
          type="submit"
          class={touchButton}
          disabled={busy() || testing()}
        >
          <Show when={busy()}>
            <LoaderCircle class="size-4 animate-spin" />
          </Show>
          {busy()
            ? t("action.saving")
            : (props.submitLabel ?? t("action.save"))}
        </Button>
      </div>
    </form>
  );
}
