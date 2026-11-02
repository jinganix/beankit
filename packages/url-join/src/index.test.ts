import { describe, expect, it } from "vitest";

import { urlJoin } from "./index";

describe("urlJoin", () => {
  it("joins path segments", () => {
    expect(urlJoin("http://api.test", "v1", "users")).toBe("http://api.test/v1/users");
  });

  it("normalizes duplicate slashes but keeps the trailing slash", () => {
    expect(urlJoin("http://api.test/", "/v1/", "/users/")).toBe("http://api.test/v1/users/");
  });

  it("returns empty string for no input", () => {
    expect(urlJoin()).toBe("");
  });

  it("returns empty string when every segment is empty", () => {
    expect(urlJoin("", "")).toBe("");
  });

  it("throws a TypeError when the first segment is not a string", () => {
    expect(() => urlJoin(null as unknown as string)).toThrow(TypeError);
    expect(() => urlJoin(null as unknown as string)).toThrow("Url must be a string. Received null");
  });

  it("accepts an array as the first argument", () => {
    expect(urlJoin(["http://api.test", "v1"])).toBe("http://api.test/v1");
  });

  it("keeps three slashes for the file protocol", () => {
    expect(urlJoin("file:///tmp", "data")).toBe("file:///tmp/data");
  });

  it("merges a protocol-only first segment with the next part", () => {
    expect(urlJoin("http:", "api.test", "v1")).toBe("http://api.test/v1");
  });

  it("keeps a lone protocol segment usable", () => {
    expect(urlJoin("http:")).toBe("http:/");
  });

  it("merges a root slash with the next part", () => {
    expect(urlJoin("/", "foo")).toBe("/foo");
  });

  it("keeps a lone root slash", () => {
    expect(urlJoin("/")).toBe("/");
  });

  it("skips slash-only segments between path parts", () => {
    expect(urlJoin("http://api.test", "/", "v1")).toBe("http://api.test/v1");
  });

  it("skips empty segments between path parts", () => {
    expect(urlJoin("http://api.test", "v1", "", "users")).toBe("http://api.test/v1/users");
  });

  it("returns a single segment unchanged", () => {
    expect(urlJoin("http://api.test")).toBe("http://api.test");
  });

  it("merges query parts with &", () => {
    expect(urlJoin("http://api.test", "?a=1", "?b=2")).toBe("http://api.test?a=1&b=2");
  });

  it("joins a segment that already contains a query string", () => {
    expect(urlJoin("http://api.test", "path?a=1", "b=2")).toBe("http://api.test/path?a=1/b=2");
  });

  it("collapses a slash before a query marker", () => {
    expect(urlJoin("http://api.test", "?a=1")).toBe("http://api.test?a=1");
  });

  it("drops a dangling query marker", () => {
    expect(urlJoin("http://api.test", "?")).toBe("http://api.test");
  });

  it("returns empty string for a lone query marker", () => {
    expect(urlJoin("?")).toBe("");
  });

  it("appends to a segment ending with ?", () => {
    expect(urlJoin("http://api.test?", "a=1")).toBe("http://api.test?a=1");
  });

  it("appends to a segment ending with #", () => {
    expect(urlJoin("http://api.test#", "sec")).toBe("http://api.test#sec");
  });

  it("preserves a hash segment", () => {
    expect(urlJoin("http://api.test", "page#section")).toBe("http://api.test/page#section");
  });

  it("keeps the slash before a hashbang", () => {
    expect(urlJoin("http://api.test", "x", "#!/y")).toBe("http://api.test/x/#!/y");
  });

  it("drops an empty hash marker", () => {
    expect(urlJoin("http://api.test", "#")).toBe("http://api.test/");
  });

  it("returns empty string for a lone hash marker", () => {
    expect(urlJoin("#")).toBe("");
  });

  it("throws a TypeError when a later segment is not a string", () => {
    expect(() => urlJoin("a", null as unknown as string)).toThrow(TypeError);
    expect(() => urlJoin("a", null as unknown as string)).toThrow(
      "Url must be a string. Received null",
    );
  });

  it("does not treat a host with a port as a protocol", () => {
    expect(urlJoin("127.0.0.1:5500", "data", "myfile1.csv")).toBe(
      "127.0.0.1:5500/data/myfile1.csv",
    );
    expect(urlJoin("localhost:3000", "a")).toBe("localhost:3000/a");
  });

  it("keeps an explicit port after a plain protocol", () => {
    expect(urlJoin("http:", "3000")).toBe("http://3000");
  });

  it("leaves IPv6 hosts alone", () => {
    expect(urlJoin("[::1]:8080", "a")).toBe("[::1]:8080/a");
    expect(urlJoin("http://[::1]:8080/", "a")).toBe("http://[::1]:8080/a");
  });

  it("keeps the slash after a hash only when the input had one", () => {
    expect(urlJoin("http://foo.com#", "/tenant")).toBe("http://foo.com#/tenant");
    expect(urlJoin("http://foo.com", "#", "/tenant")).toBe("http://foo.com#/tenant");
    expect(urlJoin("http://foo.com#", "tenant")).toBe("http://foo.com#tenant");
  });

  it("keeps an explicit slash before the query string", () => {
    expect(urlJoin("http://foo.com/", "?a=1")).toBe("http://foo.com/?a=1");
    expect(urlJoin("http://foo.com", "bar/", "?a=1")).toBe("http://foo.com/bar/?a=1");
    expect(urlJoin("http://foo.com/bar/?a=1")).toBe("http://foo.com/bar/?a=1");
    expect(urlJoin("http://www.google.com/", "a", "/b/cd", "/?e")).toBe(
      "http://www.google.com/a/b/cd/?e",
    );
  });

  it("merges a later query part after an explicit slash", () => {
    expect(urlJoin("http://foo.com/?a=1", "?b=2")).toBe("http://foo.com/?a=1&b=2");
  });

  it("keeps the query marker for query-only inputs", () => {
    expect(urlJoin("?a=1")).toBe("?a=1");
    expect(urlJoin("/?a")).toBe("?a");
    expect(urlJoin("/", "?a=1")).toBe("?a=1");
  });
});
