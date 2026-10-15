export interface PasswordHasher {
  hash(password: string): string;
  verify(password: string, hash: string): boolean;
}
