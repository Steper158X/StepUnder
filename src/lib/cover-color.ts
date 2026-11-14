import type { SubsonicClient } from "~/lib/subsonic";

/** A cover's accent as HSL: hue 0–360, saturation and lightness 0–1. */
export type CoverColor = { h: number; s: number; l: number };

const cache = new Map<string, Promise<CoverColor | null>>();

function toHsl(r: number, g: number, b: number): CoverColor {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * Picks the cover's most prominent colorful tone rather than a plain average
 * (which turns most artwork into mud): pixels are grouped by hue and weighted
 * by saturation, skipping near-black and near-white. Grey covers fall back to
 * their average tone.
 */
function dominantColor(data: Uint8ClampedArray): CoverColor | null {
  const BUCKETS = 18;
  const sums = Array.from({ length: BUCKETS }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    avgR += r;
    avgG += g;
    avgB += b;
    count += 1;

    const { h, s, l } = toHsl(r, g, b);
    if (l < 0.1 || l > 0.93 || s < 0.15) continue;
    // Favor vivid mid-tones; very dark or washed-out pixels count less.
    const weight = s * s * (1 - Math.abs(l - 0.5) * 1.4);
    if (weight <= 0) continue;
    const bucket = sums[Math.floor(h / (360 / BUCKETS)) % BUCKETS];
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    bucket.w += weight;
  }
  if (!count) return null;

  // Merge each bucket with its neighbours so a hue split across a boundary
  // still wins over a smaller but tidier one.
  let best = -1;
  let bestWeight = 0;
  for (let i = 0; i < BUCKETS; i += 1) {
    const w =
      sums[i].w +
      0.5 * (sums[(i + BUCKETS - 1) % BUCKETS].w + sums[(i + 1) % BUCKETS].w);
    if (w > bestWeight) {
      bestWeight = w;
      best = i;
    }
  }

  // Under ~4% of "vivid weight" the cover is effectively monochrome.
  if (best < 0 || bestWeight < count * 0.04) {
    return toHsl(avgR / count, avgG / count, avgB / count);
  }
  const pick = sums[best];
  return toHsl(pick.r / pick.w, pick.g / pick.w, pick.b / pick.w);
}

async function extract(
  client: SubsonicClient,
  coverArtId: string,
): Promise<CoverColor | null> {
  const blob = await client.coverBlob(coverArtId, 64);
  const bitmap = await createImageBitmap(blob);
  const SIZE = 32;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close();
  return dominantColor(context.getImageData(0, 0, SIZE, SIZE).data);
}

/** The cover's accent color, cached per cover id; null when it can't be read. */
export function coverColor(
  client: SubsonicClient,
  coverArtId: string,
): Promise<CoverColor | null> {
  const key = `${client.baseUrl}|${coverArtId}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = extract(client, coverArtId).catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Turns a raw cover color into one that reads as soft light: enough
 * saturation to have a hue, lightness kept in a range that glows on both
 * light and dark backgrounds. Returns space-separated HSL for `hsl(... / a)`.
 */
export function glowHsl(color: CoverColor): string {
  const grey = color.s < 0.12;
  const s = grey ? color.s * 100 : Math.min(85, Math.max(45, color.s * 100));
  const l = Math.min(62, Math.max(48, color.l * 100));
  return `${color.h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%`;
}
