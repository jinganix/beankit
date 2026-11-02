/**
 * Opt-in bigint codec for `@beankit/all`.
 *
 * This subpath is the only place in this package that touches the `BigInt`
 * global. Keep it out of bundles for runtimes without BigInt and import the
 * main `@beankit/all` entry instead, where out-of-range integers decode to
 * decimal strings.
 *
 * @example
 * import { decodeCBORWithBigInt, encodeCBORWithBigInt } from "@beankit/all/bigint";
 */
export * from "../../cbor/src/bigint";
