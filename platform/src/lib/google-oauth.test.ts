import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthorizationRequest } from "./google-oauth.ts";

// Fake, non-secret placeholder values -- only used to construct a URL, no
// network call happens in buildAuthorizationRequest.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";

test("buildAuthorizationRequest points at Google's authorization endpoint with the right params", () => {
  const { url, state, codeVerifier } = buildAuthorizationRequest();

  assert.equal(url.hostname, "accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "test-client-id");
  assert.equal(url.searchParams.get("redirect_uri"), process.env.GOOGLE_REDIRECT_URI);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), state);
  assert.ok(url.searchParams.get("scope")?.includes("email"));
  assert.ok(url.searchParams.get("code_challenge"));
  assert.equal(url.searchParams.get("prompt"), "select_account");
  assert.ok(state.length > 0);
  assert.ok(codeVerifier.length > 0);
});

test("buildAuthorizationRequest generates a different state each call", () => {
  const a = buildAuthorizationRequest();
  const b = buildAuthorizationRequest();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.codeVerifier, b.codeVerifier);
});
