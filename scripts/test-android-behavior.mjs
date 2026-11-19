import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

async function load(path) {
  const source = await fs.readFile(new URL(path, import.meta.url), "utf8");
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}
const { registerBackLayer, dismissBackLayer } = await load("../src/lib/android-back.ts");
const closed = [];
const offPlayer = registerBackLayer("now-playing", () => closed.push("player"));
const offDialog = registerBackLayer("dialog", () => closed.push("dialog"));
const offMenu = registerBackLayer("menu", () => closed.push("menu"));
assert.equal(dismissBackLayer(), true);
assert.deepEqual(closed, ["menu"]);
offMenu();
dismissBackLayer();
assert.deepEqual(closed, ["menu", "dialog"]);
offDialog();
dismissBackLayer();
assert.deepEqual(closed, ["menu", "dialog", "player"]);
offPlayer();
assert.equal(dismissBackLayer(), false);
const { sheetDrag, shouldDismissSheet } = await load("../src/lib/sheet-gesture.ts");
assert.equal(sheetDrag({ x: 0, y: 0 }, { x: 5, y: 100 }), 100);
assert.equal(sheetDrag({ x: 0, y: 0 }, { x: 100, y: 10 }), null);
assert.equal(sheetDrag({ x: 0, y: 0 }, { x: 0, y: -100 }), 0);
assert.equal(shouldDismissSheet(87), false);
assert.equal(shouldDismissSheet(88), true);
assert.equal(shouldDismissSheet(0), false);
console.log("Android overlay ordering and sheet threshold behavior passed");
