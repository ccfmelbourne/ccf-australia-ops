import { Google, generateState, generateCodeVerifier } from "arctic";

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example.`);
  }
  return value;
}

function getGoogleClient(): Google {
  return new Google(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI"),
  );
}

export function buildAuthorizationRequest(): {
  url: URL;
  state: string;
  codeVerifier: string;
} {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = getGoogleClient().createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);
  return { url, state, codeVerifier };
}

// Not unit-tested (network call) — arctic itself doesn't verify/decode the
// ID token, so this follows the standard arctic pattern of calling Google's
// userinfo endpoint with the access token instead.
export async function resolveGoogleProfile(
  code: string,
  codeVerifier: string,
): Promise<GoogleProfile> {
  const tokens = await getGoogleClient().validateAuthorizationCode(code, codeVerifier);
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google user profile: ${res.status}`);
  }
  const profile = (await res.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture ?? null,
  };
}
