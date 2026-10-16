export interface PushKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}

export interface PushKeyGenerator {
  generateKeyPair(): PushKeyPair;
}
