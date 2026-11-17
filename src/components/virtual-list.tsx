import { For, Show, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { createVirtualizer, defaultRangeExtractor } from "@tanstack/solid-virtual";

export function VirtualList<T>(props: {
  items: T[];
  estimateSize: number;
  pinnedIndex?: number;
  children: (item: T, index: number) => JSX.Element;
  class?: string;
  ref?: (element: HTMLDivElement) => void;
}) {
  let container!: HTMLDivElement;
  const [scroller, setScroller] = createSignal<HTMLElement | null>(null);
  const [margin, setMargin] = createSignal(0);
  const virtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
    get count() {
      return props.items.length;
    },
    getScrollElement: scroller,
    estimateSize: () => props.estimateSize,
    overscan: 6,
    get scrollMargin() {
      return margin();
    },
    get rangeExtractor() {
      const pinned = props.pinnedIndex;
      const count = props.items.length;
      return (range: Parameters<typeof defaultRangeExtractor>[0]) => {
        const indexes = defaultRangeExtractor(range);
        if (
          pinned !== undefined &&
          pinned >= 0 &&
          pinned < count &&
          !indexes.includes(pinned)
        ) {
          indexes.push(pinned);
          indexes.sort((a, b) => a - b);
        }
        return indexes;
      };
    },
  });

  onMount(() => {
    let parent = container.parentElement;
    while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
      parent = parent.parentElement;
    }
    const element = parent ?? document.documentElement;
    setScroller(element);
    const update = () => setMargin(
      container.getBoundingClientRect().top -
        element.getBoundingClientRect().top +
        element.scrollTop - element.clientTop,
    );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    onCleanup(() => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    });
  });

  return (
    <div
      ref={(element) => {
        container = element;
        props.ref?.(element);
      }}
      class={props.class}
      style={{
        position: "relative",
        height: `${virtualizer.getTotalSize()}px`,
        "overflow-anchor": "none",
      }}
    >
      <For each={virtualizer.getVirtualItems()}>
        {(row) => (
          <div
            data-index={row.index}
            ref={(element) => virtualizer.measureElement(element)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start - margin()}px)`,
            }}
          >
            <Show when={props.items[row.index]} keyed>
              {(item) => props.children(item, row.index)}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
