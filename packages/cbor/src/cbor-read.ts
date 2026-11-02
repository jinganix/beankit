const LIMB_BASE = 10_000_000;
const LIMB_DIGITS = 7;
export const TWO_POW_32 = 4_294_967_296;

/**
 * Cursor over a CBOR byte stream. Every read is bounds-checked here, so the decoders can
 * stay free of offset arithmetic and length bookkeeping.
 */
export class Reader {
  offset: number;

  constructor(
    private readonly view: DataView,
    offset: number,
  ) {
    this.offset = offset;
  }

  /** True once every byte of the input has been consumed. */
  get exhausted(): boolean {
    return this.offset >= this.view.byteLength;
  }

  /** Next byte, without consuming it. */
  peek(): number {
    if (this.offset >= this.view.byteLength) {
      throw truncated();
    }
    return this.view.getUint8(this.offset);
  }

  uint8(): number {
    const value = this.peek();
    this.offset += 1;
    return value;
  }

  uint16(): number {
    this.require(2);
    const value = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return value;
  }

  uint32(): number {
    this.require(4);
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  /** 64 bits as a `[high, low]` pair: a JS number cannot hold the whole value. */
  uint64(): [number, number] {
    this.require(8);
    const high = this.view.getUint32(this.offset, false);
    const low = this.view.getUint32(this.offset + 4, false);
    this.offset += 8;
    return [high, low];
  }

  float32(): number {
    this.require(4);
    const value = this.view.getFloat32(this.offset, false);
    this.offset += 4;
    return value;
  }

  float64(): number {
    this.require(8);
    const value = this.view.getFloat64(this.offset, false);
    this.offset += 8;
    return value;
  }

  /** Consumes `count` bytes and returns a copy that does not alias the caller's buffer. */
  take(count: number): Uint8Array {
    this.require(count);
    const start = this.offset;
    this.offset = start + count;
    return new Uint8Array(this.view.buffer, this.view.byteOffset + start, count).slice();
  }

  /**
   * Arguments 24..27 carry their value in 1, 2, 4 or 8 following bytes; read it as a
   * `[high, low]` pair. A value that fits a shorter form is ill-formed (RFC 8949 §3).
   */
  extendedArgument(argument: number): [number, number] {
    let high = 0;
    let low: number;
    switch (argument) {
      case 24:
        low = this.uint8();
        break;
      case 25:
        low = this.uint16();
        break;
      case 26:
        low = this.uint32();
        break;
      case 27:
        [high, low] = this.uint64();
        break;
      default:
        throw new Error(`reserved CBOR argument ${argument}`);
    }
    if (high === 0 && low < 24) {
      throw new Error(`non-preferred CBOR argument ${low}`);
    }
    return [high, low];
  }

  private require(count: number): void {
    if (count > this.view.byteLength - this.offset) {
      throw truncated();
    }
  }
}

function truncated(): Error {
  return new Error("unexpected end of CBOR input");
}

/**
 * Formats an unsigned 64-bit value as decimal text, without bigint and without ever
 * leaving the safe integer range: the value is converted byte by byte into base 10^7
 * limbs, where each step stays below 2^32.
 */
export function formatUint64(high: number, low: number): string {
  const limbs = [0];
  const bytes = [
    high >>> 24,
    high >>> 16,
    high >>> 8,
    high,
    low >>> 24,
    low >>> 16,
    low >>> 8,
    low,
  ];
  for (const byte of bytes) {
    let carry = byte & 0xff;
    for (let i = 0; i < limbs.length; i++) {
      const value = limbs[i]! * 256 + carry;
      limbs[i] = value % LIMB_BASE;
      carry = Math.floor(value / LIMB_BASE);
    }
    while (carry > 0) {
      limbs.push(carry % LIMB_BASE);
      carry = Math.floor(carry / LIMB_BASE);
    }
  }
  let text = String(limbs[limbs.length - 1]!);
  for (let i = limbs.length - 2; i >= 0; i--) {
    text += String(limbs[i]!).padStart(LIMB_DIGITS, "0");
  }
  return text;
}

/** `text + 1` for a decimal string of any length. */
export function incrementDecimal(text: string): string {
  let index = text.length - 1;
  while (index >= 0 && text.charAt(index) === "9") {
    index -= 1;
  }
  if (index < 0) {
    return `1${"0".repeat(text.length)}`;
  }
  const digit = Number(text.charAt(index)) + 1;
  return `${text.slice(0, index)}${digit}${"0".repeat(text.length - index - 1)}`;
}
