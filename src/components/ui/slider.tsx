import { splitProps, type ComponentProps } from "solid-js";
import { Slider as KSlider } from "@kobalte/core/slider";
import { cn } from "~/lib/utils";

export interface SliderProps {
  value: number;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  class?: string;
  ariaLabel?: string;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
}

export function Slider(props: SliderProps) {
  return (
    <KSlider
      value={[props.value]}
      minValue={props.min ?? 0}
      maxValue={props.max}
      step={props.step ?? 1}
      disabled={props.disabled}
      onChange={(values) => props.onValueChange?.(values[0])}
      onChangeEnd={(values) => props.onValueCommit?.(values[0])}
      class={cn(
        "relative flex w-full touch-none select-none items-center",
        props.disabled ? "cursor-default" : "cursor-pointer",
        props.class,
      )}
    >
      <KSlider.Track class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <KSlider.Fill class="absolute h-full bg-primary" />
      </KSlider.Track>
      <KSlider.Thumb
        class="block size-3 rounded-full border border-primary bg-background shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        aria-label={props.ariaLabel}
      />
    </KSlider>
  );
}

export function Progress(props: { value: number; max: number; class?: string }) {
  const [local] = splitProps(props, ["class"]);
  const percent = () =>
    props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0;
  return (
    <div class={cn("h-1 w-full overflow-hidden rounded-full bg-muted", local.class)}>
      <div class="h-full bg-primary transition-[width]" style={{ width: `${percent()}%` }} />
    </div>
  );
}

export type SliderRootProps = ComponentProps<typeof KSlider>;
