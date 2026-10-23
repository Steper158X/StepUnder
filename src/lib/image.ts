/** Formats Navidrome accepts for playlist covers. */
export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class CoverImageError extends Error {
  constructor(readonly reason: "type" | "size" | "decode") {
    super(reason);
    this.name = "CoverImageError";
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new CoverImageError("decode"));
    };
    image.src = url;
  });
}

/**
 * Center-crops the picked file to a square JPEG of at most `size` px so
 * uploads stay small. Animated GIFs are kept as-is to preserve the animation.
 */
export async function prepareCoverImage(
  file: File,
  size = 1000,
): Promise<{ blob: Blob; filename: string }> {
  if (!COVER_IMAGE_TYPES.includes(file.type)) throw new CoverImageError("type");

  if (file.type === "image/gif") {
    if (file.size > MAX_UPLOAD_BYTES) throw new CoverImageError("size");
    return { blob: file, filename: "cover.gif" };
  }

  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const target = Math.min(side, size);
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const context = canvas.getContext("2d");
  if (!context) throw new CoverImageError("decode");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    target,
    target,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new CoverImageError("decode");
  if (blob.size > MAX_UPLOAD_BYTES) throw new CoverImageError("size");
  return { blob, filename: "cover.jpg" };
}
