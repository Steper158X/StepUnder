import { splitProps, type JSX } from "solid-js";
import { cn } from "~/lib/utils";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm",
        local.class,
      )}
      {...rest}
    />
  );
}

export function CardHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col gap-1.5 p-5", local.class)} {...rest} />
  );
}

export function CardTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <h3
      class={cn("text-base font-semibold leading-none tracking-tight", local.class)}
      {...rest}
    />
  );
}

export function CardDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <p class={cn("text-sm text-muted-foreground", local.class)} {...rest} />
  );
}

export function CardContent(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return <div class={cn("p-5 pt-0", local.class)} {...rest} />;
}

export function CardFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex items-center p-5 pt-0", local.class)} {...rest} />
  );
}
