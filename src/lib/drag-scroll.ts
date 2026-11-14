/** How far the mouse must move before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 5;

/**
 * Lets a mouse drag a horizontal scroller sideways, the way a finger swipes it.
 * Touch and pen keep their native scrolling. A press that moves less than a
 * few pixels stays a normal click, so cards inside still open.
 */
export function dragScroll(element: HTMLElement): void {
  let startX = 0;
  let startScroll = 0;
  let pointerId: number | null = null;
  let dragging = false;

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (element.scrollWidth <= element.clientWidth) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = element.scrollLeft;
    dragging = false;
  });

  element.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      dragging = true;
      element.setPointerCapture(event.pointerId);
      element.style.cursor = "grabbing";
      element.style.userSelect = "none";
    }
    element.scrollLeft = startScroll - dx;
  });

  const end = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    element.style.cursor = "";
    element.style.userSelect = "";
    // `dragging` stays set until the click that follows the release is eaten.
    if (dragging) setTimeout(() => (dragging = false));
  };
  element.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);

  // The release after a drag still fires a click on the card under the mouse.
  element.addEventListener(
    "click",
    (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = false;
    },
    true,
  );

  // Links and images would otherwise start the browser's own drag-and-drop.
  element.addEventListener("dragstart", (event) => event.preventDefault());
}
