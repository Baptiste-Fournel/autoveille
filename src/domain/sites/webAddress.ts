const WEB_ADDRESS = /^https?:/i;

export const isWebAddress = (address: string): boolean => WEB_ADDRESS.test(address);
