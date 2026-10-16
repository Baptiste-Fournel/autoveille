const BASE64_BLOCK = 4;

export const applicationServerKeyOf = (base64Url: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((BASE64_BLOCK - (base64Url.length % BASE64_BLOCK)) % BASE64_BLOCK);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base64)].map((character) => character.charCodeAt(0)));
};
