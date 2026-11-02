export type MajorType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const MAJOR_TYPE_UNSIGNED_INTEGER: MajorType = 0;
export const MAJOR_TYPE_NEGATIVE_INTEGER: MajorType = 1;
export const MAJOR_TYPE_BYTE_STRING: MajorType = 2;
export const MAJOR_TYPE_TEXT_STRING: MajorType = 3;
export const MAJOR_TYPE_ARRAY: MajorType = 4;
export const MAJOR_TYPE_MAP: MajorType = 5;
export const MAJOR_TYPE_TAG: MajorType = 6;
export const MAJOR_TYPE_SIMPLE_OR_FLOAT: MajorType = 7;

/**
 * A value wrapped with a CBOR Tag. Tag semantics are not interpreted when decoded or encoded.
 *
 * `tag` is `number` unless the tag number is outside the safe integer range, where the
 * `@beankit/cbor/bigint` entry point decodes it as a native `bigint`.
 */
export class CBORTag<T = CBORType> {
  constructor(
    readonly tag: number | bigint,
    readonly value: T,
  ) {}
}

/** Everything the decoder accepts: a view over bytes, or the buffer itself. */
export type CBORInput = DataView | Uint8Array | ArrayBufferLike;

/**
 * Supported map key types: strings and numbers, plus `bigint` for out-of-range integers,
 * which only the `@beankit/cbor/bigint` entry point decodes.
 */
export type CBORMapKey = number | string | bigint;

/** Supported CBOR value types (plain objects omitted). */
export type CBORType =
  | number
  | string
  | Uint8Array
  | boolean
  | null
  | undefined
  | CBORType[]
  | CBORTag<CBORType>
  | Map<number | string, CBORType>;

/**
 * Like {@link CBORType}, but integers outside the safe range decode to (and encode from)
 * native `bigint`. Only available through `@beankit/cbor/bigint`, which requires a
 * BigInt-capable runtime. Out-of-range integers decode to decimal strings in the
 * default entry point instead.
 */
export type BigIntCBORType =
  | number
  | bigint
  | string
  | Uint8Array
  | boolean
  | null
  | undefined
  | BigIntCBORType[]
  | CBORTag<BigIntCBORType>
  | Map<CBORMapKey, BigIntCBORType>;
