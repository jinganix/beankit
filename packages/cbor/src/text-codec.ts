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

/**
 * Decodes UTF-8 exactly like `TextDecoder`: an invalid sequence emits one U+FFFD for its
 * maximal subpart, and the byte that broke it is decoded again. A strict decoder matters
 * because the same CBOR bytes must not decode to different text on a runtime without
 * `TextDecoder` (e.g. WeChat MiniProgram JSCore) than on Node or the browser.
 */
function utf8Decode(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i]!;
    if (first < 0x80) {
      result += String.fromCharCode(first);
      i += 1;
      continue;
    }

    // Continuation count plus the range the first continuation byte must fall in,
    // which is what rejects overlong forms, surrogates and code points above U+10FFFF.
    let continuations: number;
    let lower = 0x80;
    let upper = 0xbf;
    let codePoint: number;
    if (first >= 0xc2 && first <= 0xdf) {
      continuations = 1;
      codePoint = first & 0x1f;
    } else if (first >= 0xe0 && first <= 0xef) {
      continuations = 2;
      codePoint = first & 0x0f;
      if (first === 0xe0) lower = 0xa0;
      if (first === 0xed) upper = 0x9f;
    } else if (first >= 0xf0 && first <= 0xf4) {
      continuations = 3;
      codePoint = first & 0x07;
      if (first === 0xf0) lower = 0x90;
      if (first === 0xf4) upper = 0x8f;
    } else {
      result += "\ufffd";
      i += 1;
      continue;
    }

    let consumed = 1;
    for (let offset = 1; offset <= continuations; offset++) {
      const index = i + offset;
      // Truncated input: the bytes read so far are one maximal subpart.
      if (index >= bytes.length) {
        consumed = offset;
        break;
      }
      const byte = bytes[index]!;
      // A byte outside the range ends the sequence here and is decoded again next.
      if (offset === 1 ? byte < lower || byte > upper : byte < 0x80 || byte > 0xbf) {
        consumed = offset;
        break;
      }
      codePoint = (codePoint << 6) | (byte & 0x3f);
      consumed = offset + 1;
    }
    if (consumed <= continuations) {
      result += "\ufffd";
      i += consumed;
      continue;
    }

    result +=
      continuations === 3
        ? String.fromCharCode(
            0xd8_00 + ((codePoint - 0x1_00_00) >> 10),
            0xdc_00 + ((codePoint - 0x1_00_00) & 0x3_ff),
          )
        : String.fromCharCode(codePoint);
    i += consumed;
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
