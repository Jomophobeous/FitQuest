import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export async function verifyGoogleIdToken(idToken, audience) {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    audience,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });

  return {
    providerUserId: String(payload.sub || ''),
    email: payload.email ? String(payload.email) : null,
    name: payload.name ? String(payload.name) : null,
  };
}

export async function verifyAppleIdToken(idToken, audience) {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    audience,
    issuer: 'https://appleid.apple.com',
  });

  return {
    providerUserId: String(payload.sub || ''),
    email: payload.email ? String(payload.email) : null,
    name: null,
  };
}
