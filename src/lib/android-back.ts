export type BackLayer = "menu" | "dialog" | "output" | "queue" | "now-playing";
const priority: Record<BackLayer, number> = { menu: 5, dialog: 4, output: 3, queue: 2, "now-playing": 1 };
const layers: { kind: BackLayer; close: () => void }[] = [];

export function registerBackLayer(kind: BackLayer, close: () => void) {
  const layer = { kind, close };
  layers.push(layer);
  return () => { const index = layers.indexOf(layer); if (index >= 0) layers.splice(index, 1); };
}

export function dismissBackLayer() {
  const top = layers.reduce<typeof layers[number] | undefined>((best, layer) =>
    !best || priority[layer.kind] >= priority[best.kind] ? layer : best, undefined);
  if (!top) return false;
  top.close();
  return true;
}

declare global { interface Window { __stepunderBack?: () => boolean } }
