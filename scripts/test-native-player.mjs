import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

const source = await fs.readFile(new URL("../src/lib/android-player.ts", import.meta.url), "utf8");
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const calls = [];
const listeners = new Map();
globalThis.document = {
  hidden: false,
  addEventListener: (name, handler) => listeners.set(name, handler),
  removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
};
globalThis.window = { StepUnderPlayer: new Proxy({}, {
  get: (_, method) => (...args) => calls.push([method, ...args]),
}) };
const bridge = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const events = [];
const cleanup = bridge.onNativePlayerEvent(event => events.push(event));
assert.deepEqual(calls.pop(), ["setForeground", true]);
document.hidden = true;
listeners.get("visibilitychange")();
assert.deepEqual(calls.pop(), ["setForeground", false]);
const state = { type: "state", currentIndex: 1, position: 12, playing: true, loading: false, duration: 180, volume: 0.8, muted: false, serverId: "a" };
window.__stepunderPlayerEvent(JSON.stringify(state));
assert.deepEqual(events, [state]);
bridge.nativeSeek(Number.NaN);
assert.equal(calls.length, 0);
bridge.nativeSetVolume(2);
assert.deepEqual(calls.pop(), ["setVolume", 1]);
bridge.nativeSetVolume(-1);
assert.deepEqual(calls.pop(), ["setVolume", 0]);
bridge.nativeNext();
assert.deepEqual(calls.pop(), ["next"]);
cleanup();
assert.equal(window.__stepunderPlayerEvent, undefined);
assert.equal(listeners.size, 0);
assert.deepEqual(calls.pop(), ["setForeground", false]);
// Exercise the actual event reducer with a minimal store and server boundary.
const storeSource = await fs.readFile(new URL("../src/player/store.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("store.tsx", storeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "handleNativeEvent") handler = node.getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler);
const handlerJs = ts.transpile(handler, { target: ts.ScriptTarget.ES2022 }).replace(/^"use strict";\s*/, "");
// Free variables resolve through this intentionally small executable harness.
const harness = new Function("handlerJs", `
  const nativeEngine = true;
  let activeId = "a", nativeLoaded = false, nativeServerId = null, restoreAttempted = false;
  let nativeQueueSignature = "", pendingNativeSnapshot = null, nativeRecovery = null, scrobbledCurrent = true;
  let stops = 0, reports = 0, ready = false, persisted = null;
  const state = { queue: [], index: -1 };
  const servers = { activeId: () => activeId, client: () => activeId ? {} : null };
  const current = () => state.queue[state.index];
  const setState = (key, value) => typeof key === "string" ? state[key] = value : Object.assign(state, key);
  const queueSignature = (queue, repeat, shuffle, sourceName) => JSON.stringify([queue, repeat, shuffle, sourceName]);
  const setNativeReady = value => ready = value;
  const nativeStop = () => stops++;
  const updateMediaSession = () => {};
  const reportNowPlaying = () => reports++;
  const maybeScrobble = () => {};
  const setPersisted = value => persisted = value;
  const fallBackToStream = () => false;
  const t = key => key;
  const handle = eval("(" + handlerJs.trim() + ")");
  return { handle, state, active: value => activeId = value,
    inspect: () => ({ stops, reports, ready, nativeLoaded, pendingNativeSnapshot, persisted, scrobbledCurrent }) };
`)(handlerJs);
const snapshot = { ...state, type: "snapshot", repeat: "one", shuffle: false, radio: true, sourceName: "Radio", items: [{ id: "x", song: { id: "x", title: "X" } }, { id: "x", song: { id: "x", title: "X" } }] };
harness.active(null);
harness.handle(snapshot);
assert.equal(harness.inspect().ready, false);
assert.equal(harness.inspect().reports, 0);
assert.equal(harness.inspect().pendingNativeSnapshot, snapshot);
harness.active("b");
harness.handle(snapshot);
assert.equal(harness.inspect().stops, 1);
assert.equal(harness.inspect().reports, 0);
harness.active("a");
harness.handle(snapshot);
assert.equal(harness.state.index, 1);
assert.equal(harness.state.radio, true);
assert.equal(harness.inspect().reports, 1);
harness.handle(snapshot);
assert.equal(harness.inspect().reports, 1, "structural snapshots do not report another play");
const queue = harness.state.queue;
harness.handle({ ...state, position: 13 });
assert.equal(harness.state.queue, queue);
assert.equal(harness.inspect().reports, 1);
harness.handle({ ...state, transition: true, position: 0 });
assert.equal(harness.inspect().reports, 2, "repeat of same queue item reports a new play");
harness.handle({ ...state, currentIndex: 0 });
assert.equal(harness.state.index, 0);
assert.equal(harness.inspect().reports, 3, "duplicate song entries remain distinct by index");
harness.handle({ type: "error", message: "test failure" });
assert.equal(harness.state.loading, false);
assert.equal(harness.state.playing, false);
assert.equal(harness.state.error, "player.streamError");
console.log("Native bridge and store restore, server isolation, duplicate progression, repeat, and error behavior passed");
