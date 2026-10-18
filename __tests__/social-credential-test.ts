import { getSocialCredential, SocialLoginNotReadyError } from '@/session/social-credential';

test('returns the bootTestRun fake credential in development', async () => {
  await expect(getSocialCredential('kakao', true)).resolves.toMatch(/^ok:.+/);
});

test('refuses outside development until the SDKs are wired', async () => {
  await expect(getSocialCredential('google', false)).rejects.toBeInstanceOf(SocialLoginNotReadyError);
});
