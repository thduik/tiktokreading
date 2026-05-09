import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminSessionToken,
  readAdminAuthConfig,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "./admin-auth";

test("admin auth config requires username and password", () => {
  assert.equal(readAdminAuthConfig({}), null);
  assert.deepEqual(readAdminAuthConfig({
    ADMIN_USERNAME: "admin1",
    ADMIN_PASSWORD: "secret",
    ADMIN_SESSION_SECRET: "session-secret",
  }), {
    username: "admin1",
    password: "secret",
    sessionSecret: "session-secret",
  });
});

test("admin credentials use exact username and password", () => {
  const config = {
    username: "admin1",
    password: "secret",
    sessionSecret: "session-secret",
  };

  assert.equal(verifyAdminCredentials({ config, username: "admin1", password: "secret" }), true);
  assert.equal(verifyAdminCredentials({ config, username: "admin1", password: "wrong" }), false);
  assert.equal(verifyAdminCredentials({ config, username: "ADMIN1", password: "secret" }), false);
});

test("admin session tokens verify until expiry", () => {
  const config = {
    username: "admin1",
    password: "secret",
    sessionSecret: "session-secret",
  };
  const now = 1000;
  const token = createAdminSessionToken({ config, now });

  assert.equal(verifyAdminSessionToken({ config, token, now: now + 1 })?.username, "admin1");
  assert.equal(verifyAdminSessionToken({ config, token, now: now + 1000 * 60 * 60 * 13 }), null);
  assert.equal(verifyAdminSessionToken({
    config: { ...config, sessionSecret: "other-secret" },
    token,
    now: now + 1,
  }), null);
});

