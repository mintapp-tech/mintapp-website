import { describe, expect, test } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Pure-Buffer PNG chunk parsing — no image-processing dependency added just
// to verify this one asset. PNG layout: 8-byte signature, then a sequence
// of [4-byte length][4-byte type][data][4-byte CRC] chunks. IHDR is always
// first and carries width/height as big-endian uint32s at fixed offsets.
const IMAGE_PATH = join(process.cwd(), "public", "og", "mintapp-default.png");

describe("public/og/mintapp-default.png — the sitewide default social-preview image", () => {
  const buffer = readFileSync(IMAGE_PATH);

  test("is a valid PNG file (correct 8-byte signature)", () => {
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  test("has exactly 1200x630 pixel dimensions, read from its own IHDR chunk", () => {
    expect(buffer.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);
  });

  test("is a reasonably optimized file size for a simple branded graphic", () => {
    const { size } = statSync(IMAGE_PATH);
    expect(size).toBeGreaterThan(1000); // sanity: not empty/corrupt
    expect(size).toBeLessThan(500 * 1024);
  });

  test("contains no tEXt/zTXt/iTXt ancillary chunks that could carry unintended metadata (authoring tool, comments, local paths)", () => {
    const textChunkTypes = new Set(["tEXt", "zTXt", "iTXt"]);
    const foundTextChunks: string[] = [];
    let offset = 8;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
      if (textChunkTypes.has(type)) foundTextChunks.push(type);
      if (type === "IEND") break;
      offset += 8 + length + 4;
    }
    expect(foundTextChunks).toEqual([]);
  });
});
