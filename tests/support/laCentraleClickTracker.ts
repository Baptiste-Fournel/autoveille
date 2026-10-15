const PREVIEWED_ADS = ['69115730001', '69115730002', '69115730003'] as const;

const TRACKED_LINKS_IN_THE_DIGEST = 49;

const LINKS_PER_PREVIEWED_AD = 10;

const FIRST_LINK_OF_THE_FIRST_AD = 4;

const FULL_LIST_ON_THE_SITE = 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART';

const destinationOfLink = (link: number): string => {
  const ad = PREVIEWED_ADS[Math.floor((link - FIRST_LINK_OF_THE_FIRST_AD) / LINKS_PER_PREVIEWED_AD)];
  return link >= FIRST_LINK_OF_THE_FIRST_AD && ad !== undefined
    ? `https://www.lacentrale.fr/auto-occasion-annonce-${ad}.html`
    : FULL_LIST_ON_THE_SITE;
};

export const laCentraleDigestLinksResolvedOverHttp = (): ReadonlyMap<string, string> =>
  new Map(
    Array.from({ length: TRACKED_LINKS_IN_THE_DIGEST }, (_, index) => index + 1).map((link) => [
      `https://clicks.mail-alerte.lacentrale.fr/f/a/t${link}~~/AAAHahA~/x`,
      destinationOfLink(link),
    ]),
  );
