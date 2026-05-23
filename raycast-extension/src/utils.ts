import * as fs from "node:fs";

export function fileToBase64(filepath: string): string {
  const buffer = fs.readFileSync(filepath);
  return buffer.toString("base64");
}

export function getImageMimeType(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}
