/**
 * Mobile webviews only open the on-screen keyboard when focus happens inside a
 * tap. A page that mounts after the tap is too late, so the tap focuses this
 * hidden stand-in and the page hands focus over with `takeKeyboardFocus`,
 * which keeps the keyboard open.
 */
let standIn: HTMLInputElement | undefined;

export function holdKeyboardFocus(): void {
  if (!standIn) {
    standIn = document.createElement("input");
    standIn.setAttribute("aria-hidden", "true");
    standIn.tabIndex = -1;
    Object.assign(standIn.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
      fontSize: "16px", // smaller text makes iOS zoom in
    });
  }
  document.body.appendChild(standIn);
  standIn.focus({ preventScroll: true });
}

export function takeKeyboardFocus(target: HTMLElement | undefined): void {
  target?.focus({ preventScroll: true });
  standIn?.remove();
}
