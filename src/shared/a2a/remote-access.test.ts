import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { BrowserShim, PermissionRequest } from "../browser.ts";
import { normalizeRemoteOrigin, requestRemoteOrigin } from "./remote-access.ts";

const CASES = [
  {
    candidate: "https://agent.example/path?tenant=one",
    origin: "https://agent.example",
    chromePattern: "https://agent.example/*",
    firefoxPattern: "https://agent.example/*",
  },
  {
    candidate: "https://agent.example:8443/a2a",
    origin: "https://agent.example:8443",
    chromePattern: "https://agent.example:8443/*",
    firefoxPattern: "https://agent.example/*",
  },
  {
    candidate: "https://agent.example:443/a2a",
    origin: "https://agent.example",
    chromePattern: "https://agent.example/*",
    firefoxPattern: "https://agent.example/*",
  },
  {
    candidate: "http://localhost:8123/a2a",
    origin: "http://localhost:8123",
    chromePattern: "http://localhost:8123/*",
    firefoxPattern: "http://localhost/*",
  },
  {
    candidate: "http://127.0.0.1:8123/a2a",
    origin: "http://127.0.0.1:8123",
    chromePattern: "http://127.0.0.1:8123/*",
    firefoxPattern: "http://127.0.0.1/*",
  },
  {
    candidate: "http://[::1]:8123/a2a",
    origin: "http://[::1]:8123",
    chromePattern: "http://[::1]:8123/*",
    firefoxPattern: "http://[::1]/*",
  },
] as const;

Deno.test("normalizeRemoteOrigin - returns exact origins and browser-specific patterns", () => {
  for (const expected of CASES) {
    assertEquals(normalizeRemoteOrigin(expected.candidate), {
      origin: expected.origin,
      chromePattern: expected.chromePattern,
      firefoxPattern: expected.firefoxPattern,
    });
  }
});

Deno.test("normalizeRemoteOrigin - canonicalizes valid internationalized hosts", () => {
  assertEquals(normalizeRemoteOrigin("https://bücher.example/a2a"), {
    origin: "https://xn--bcher-kva.example",
    chromePattern: "https://xn--bcher-kva.example/*",
    firefoxPattern: "https://xn--bcher-kva.example/*",
  });
});

Deno.test("normalizeRemoteOrigin - rejects unsafe or malformed URLs", () => {
  const rejected = [
    "http://agent.example/a2a",
    "ftp://agent.example/a2a",
    "https://user@agent.example/a2a",
    "https://agent.example/a2a#secret",
    "https://",
    "not a URL",
    "https://[::g]/a2a",
    "http://localhost.example/a2a",
    "http://0.0.0.0/a2a",
  ];

  for (const candidate of rejected) {
    assertThrows(() => normalizeRemoteOrigin(candidate), TypeError);
  }
});

function fakePermissions(
  engine: "chrome" | "firefox",
  initiallyGranted = false,
  requestResult = true,
): { permissions: BrowserShim["permissions"]; calls: PermissionRequest[] } {
  let granted = initiallyGranted;
  const calls: PermissionRequest[] = [];
  return {
    permissions: {
      engine,
      contains(request) {
        calls.push(request);
        return Promise.resolve(granted);
      },
      request(request) {
        calls.push(request);
        granted = requestResult;
        return Promise.resolve(requestResult);
      },
      remove(request) {
        calls.push(request);
        const removed = granted;
        granted = false;
        return Promise.resolve(removed);
      },
    },
    calls,
  };
}

Deno.test("requestRemoteOrigin - asks each engine for its narrowest supported grant", async () => {
  const grant = normalizeRemoteOrigin("https://agent.example:8443/a2a");
  const chrome = fakePermissions("chrome");
  const firefox = fakePermissions("firefox");

  assertEquals(await requestRemoteOrigin(chrome.permissions, grant), true);
  assertEquals(await requestRemoteOrigin(firefox.permissions, grant), true);
  assertEquals(chrome.calls, [
    { origins: ["https://agent.example:8443/*"] },
    { origins: ["https://agent.example:8443/*"] },
  ]);
  assertEquals(firefox.calls, [
    { origins: ["https://agent.example/*"] },
    { origins: ["https://agent.example/*"] },
  ]);
});

Deno.test("requestRemoteOrigin - returns existing grants without prompting again", async () => {
  const fake = fakePermissions("chrome", true);
  assertEquals(
    await requestRemoteOrigin(fake.permissions, normalizeRemoteOrigin("https://agent.example")),
    true,
  );
  assertEquals(fake.calls, [{ origins: ["https://agent.example/*"] }]);
});

Deno.test("requestRemoteOrigin - reports a denied runtime prompt", async () => {
  const fake = fakePermissions("firefox", false, false);
  assertEquals(
    await requestRemoteOrigin(fake.permissions, normalizeRemoteOrigin("https://agent.example")),
    false,
  );
});

Deno.test("requestRemoteOrigin - propagates browser API failures", async () => {
  const permissions: BrowserShim["permissions"] = {
    engine: "chrome",
    contains: () => Promise.reject(new Error("permission API unavailable")),
    request: () => Promise.resolve(false),
    remove: () => Promise.resolve(false),
  };

  await assertRejects(
    () => requestRemoteOrigin(permissions, normalizeRemoteOrigin("https://agent.example")),
    Error,
    "permission API unavailable",
  );
});
