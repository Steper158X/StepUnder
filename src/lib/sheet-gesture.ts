export function sheetDrag(start: { x: number; y: number }, point: { x: number; y: number }): number | null {
  const distance = point.y - start.y;
  return Math.abs(point.x - start.x) > Math.max(24, Math.abs(distance)) ? null : Math.max(0, distance);
}

export function shouldDismissSheet(distance: number) { return distance >= 88; }
