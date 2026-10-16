/** Only an http(s) address may become a link or an image of the app: a javascript: address read in an email would run in its page. */
export function isWebAddress(address: string): boolean {
  return /^https?:/i.test(address);
}
