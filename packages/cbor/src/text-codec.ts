export type TextCodecLike = {
  decode: (bytes: Uint8Array) => string;
  encode: (text: string) => Uint8Array;
};

function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let codePoint = text.charCodeAt(i);
    if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (codePoint <= 0xdb_ff && next >= 0xdc_00 && next <= 0xdf_ff) {
        codePoint = 0x1_00_00 + ((codePoint - 0xd8_00) << 10) + (next - 0xdc_00);
        i += 1;
      } else {
        // An unpaired surrogate cannot be encoded as UTF-8; TextEncoder emits U+FFFD.
        codePoint = 0xff_fd;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x1_00_00) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length;) {
    // The loop guard keeps the index in bounds.
    const first = bytes[i]!;
    if (first < 0x80) {
      result += String.fromCharCode(first);
      i += 1;
    } else if (first >> 5 === 0x06 && i + 1 < bytes.length) {
      const second = bytes[i + 1]!;
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      i += 2;
    } else if (first >> 4 === 0x0e && i + 2 < bytes.length) {
      const second = bytes[i + 1]!;
      const third = bytes[i + 2]!;
      result += String.fromCharCode(
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f),
      );
      i += 3;
    } else if (first >> 3 === 0x1e && i + 3 < bytes.length) {
      const second = bytes[i + 1]!;
      const third = bytes[i + 2]!;
      const fourth = bytes[i + 3]!;
      const codePoint =
        ((first & 0x07) << 18) | ((second & 0x3f) << 12) | ((third & 0x3f) << 6) | (fourth & 0x3f);
      result += String.fromCharCode(
        0xd8_00 + ((codePoint - 0x1_00_00) >> 10),
        0xdc_00 + ((codePoint - 0x1_00_00) & 0x3_ff),
      );
      i += 4;
    } else {
      result += "�";
      i += 1;
    }
  }
  return result;
}

let cachedCodec: TextCodecLike | null = null;

export function getTextCodec(): TextCodecLike {
  if (cachedCodec) {
    return cachedCodec;
  }
  const globals = globalThis as Record<string, unknown>;
  const Decoder = globals.TextDecoder as
    (new () => { decode: (bytes: Uint8Array) => string }) | undefined;
  const Encoder = globals.TextEncoder as
    (new () => { encode: (text: string) => Uint8Array }) | undefined;
  if (typeof Decoder === "function" && typeof Encoder === "function") {
    const decoder = new Decoder();
    const encoder = new Encoder();
    cachedCodec = {
      decode: (bytes) => decoder.decode(bytes),
      encode: (text) => encoder.encode(text),
    };
    return cachedCodec;
  }
  // WeChat MiniProgram JSCore has neither global; pure-JS fallback keeps
  // module import side-effect free and CBOR strings working.
  cachedCodec = { decode: utf8Decode, encode: utf8Encode };
  return cachedCodec;
}
