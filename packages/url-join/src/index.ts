const SCHEME = "[^/:\\d][^/:]*";
const PLAIN_PROTOCOL = new RegExp(`^${SCHEME}:/*$`);
const PROTOCOL_PREFIX = new RegExp(`^(${SCHEME}):/*`);
const HOST_PORT = /^[^/:]+:\d+(?:[/?#]|$)/;

/**
 * Join URL segments into a single normalized URL.
 *
 * Slashes are collapsed (an explicit slash before a query or hash is kept),
 * a protocol prefix is normalized to `protocol://` (`file:` keeps three
 * slashes), host ports and IPv6 hosts are left alone, query parts are merged
 * with `&`, and the hash suffix is preserved (hashbang `#!` keeps its
 * leading slash).
 *
 * @example
 * urlJoin("http://api.test", "v1", "users"); // "http://api.test/v1/users"
 * urlJoin("http://api.test/", "/v1/", "/users/"); // "http://api.test/v1/users/"
 * urlJoin(["http://api.test", "v1"]); // "http://api.test/v1"
 */
export function urlJoin(...args: Array<string | string[]>): string {
  const parts = (Array.isArray(args[0]) ? args[0] : args) as string[];
  return normalize([...parts]);
}

function normalize(strArray: string[]): string {
  const parts = strArray.filter((part) => part !== "");
  if (parts.length === 0) {
    return "";
  }
  const first = parts[0] as string;
  if (typeof first !== "string") {
    throw new TypeError(`Url must be a string. Received ${String(first)}`);
  }

  // A host with a port ("a:3000") is not a protocol and must not be rewritten.
  const isHostPort = HOST_PORT.test(first);

  if (parts.length > 1 && PLAIN_PROTOCOL.test(first)) {
    parts[0] = `${parts.shift() as string}${parts[0] as string}`;
  }

  if (parts.length > 1 && parts[0] === "/") {
    parts[0] = `${parts.shift() as string}${parts[0] as string}`;
  }

  // `file:` keeps three slashes, anything else normalizes to `protocol://`.
  const head = parts[0] as string;
  if (/^file:\/\//.test(head)) {
    parts[0] = head.replace(PROTOCOL_PREFIX, "$1:///");
  } else if (!isHostPort && !/^\[.*:.*\]/.test(head)) {
    parts[0] = head.replace(PROTOCOL_PREFIX, "$1://");
  }

  const resultArray: string[] = [];
  // slashBefore[i] tracks whether resultArray[i] had a slash before it.
  const slashBefore: boolean[] = [];
  let prevEndsWithSlash = false;
  let hasSuffix = false;
  let preserveTrailingSlash = false;

  for (let i = 0; i < parts.length; i++) {
    let component = parts[i] as string;

    if (typeof component !== "string") {
      throw new TypeError(`Url must be a string. Received ${String(component)}`);
    }

    const componentSuffixIndex = component.search(/[?&#]/);
    if (!hasSuffix && componentSuffixIndex !== -1) {
      preserveTrailingSlash =
        componentSuffixIndex === 0
          ? prevEndsWithSlash
          : component[componentSuffixIndex - 1] === "/";
      hasSuffix = true;
    }

    const startsWithSlash = component.startsWith("/");
    const endsWithSlash = component.endsWith("/");

    if (i > 0) {
      component = component.replace(/^[/]+/, "");
    }
    if (i < parts.length - 1) {
      component = component.replace(/[/]+$/, "");
    } else {
      component = component.replace(/[/]+$/, "/");
    }

    if (component === "") {
      prevEndsWithSlash = prevEndsWithSlash || startsWithSlash;
      continue;
    }

    resultArray.push(component);
    slashBefore.push(startsWithSlash || prevEndsWithSlash);
    prevEndsWithSlash = endsWithSlash;
  }

  let str = "";
  for (let i = 0; i < resultArray.length; i++) {
    const part = resultArray[i] as string;

    if (i === 0) {
      str += part;
      continue;
    }

    const prevPart = resultArray[i - 1] as string;

    // A query or hash continues its previous part without a new slash.
    if (prevPart.endsWith("?")) {
      str += part;
      continue;
    }

    // After a hash, keep the slash only when the input had one.
    if (prevPart.endsWith("#")) {
      str += `${slashBefore[i] === true ? "/" : ""}${part}`;
      continue;
    }

    str += `/${part}`;
  }

  // Keep an explicit slash before the query or hash ("/?a" stays "/?a").
  const suffixIndex = str.search(/[?&#]/);
  str = str.replace(/\/(\?|&|#[^!])/g, (match, separator: string, offset: number) =>
    preserveTrailingSlash && offset > 0 && offset + 1 === suffixIndex ? match : separator,
  );

  const hashIndex = str.indexOf("#");
  const beforeHash = hashIndex === -1 ? str : str.slice(0, hashIndex);
  const afterHash = hashIndex === -1 ? "" : str.slice(hashIndex + 1);
  const queryParts = beforeHash.split(/(?:\?|&)+/);
  const base = queryParts[0] as string;
  const query = queryParts.slice(1).filter(Boolean);
  str =
    `${base}${query.length > 0 ? "?" : ""}${query.join("&")}` +
    `${afterHash !== "" ? `#${afterHash}` : ""}`;

  return str;
}
