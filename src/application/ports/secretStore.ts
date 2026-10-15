export type SecretKey = 'cookie_secret' | 'vapid_public' | 'vapid_private' | 'password_hash' | 'base_url' | 'import_token';

export interface SecretStore {
  get(key: SecretKey): string | undefined;
  set(key: SecretKey, value: string): void;
  matches(key: SecretKey, candidate: string): boolean;
}
