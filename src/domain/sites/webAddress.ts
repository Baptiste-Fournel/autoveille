const WEB_ADDRESS = /^https?:/i;

const ADDRESS_WITHOUT_SCHEME = /^www\.[^\s/]+\.[a-z]{2,}(?:[/?#]|$)/i;

export const isWebAddress = (address: string): boolean => WEB_ADDRESS.test(address);

export const asWebAddress = (href: string): string | undefined => {
  const trimmed = href.trim();
  if (isWebAddress(trimmed)) {
    return trimmed;
  }
  return ADDRESS_WITHOUT_SCHEME.test(trimmed) ? `https://${trimmed}` : undefined;
};
