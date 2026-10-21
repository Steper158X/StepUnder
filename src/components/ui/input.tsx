import { splitProps, type JSX } from "solid-js";
import { cn } from "~/lib/utils";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class", "type"]);
  return (
    <input
      type={local.type ?? "text"}
      class={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      {...rest}
    />
  );
}

export function Label(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <label
      class={cn(
        "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        local.class,
      )}
      {...rest}
    />
  );
}

export function FieldHint(props: { children: JSX.Element; class?: string }) {
  return (
    <p class={cn("text-xs text-muted-foreground", props.class)}>
      {props.children}
    </p>
  );
}

export function FieldError(props: { children?: JSX.Element }) {
  return (
    <p class="text-xs font-medium text-destructive" role="alert">
      {props.children}
    </p>
  );
}
