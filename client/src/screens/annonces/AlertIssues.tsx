import type { JSX } from 'preact';

const SITE_SEPARATOR = ' : ';

const sitesOf = (alertIssues: readonly string[]): readonly string[] =>
  Array.from(new Set(alertIssues.map((issue) => issue.split(SITE_SEPARATOR)[0] ?? issue)));

export const AlertIssues = ({ alertIssues }: { readonly alertIssues: readonly string[] }): JSX.Element | null => {
  const sites = sitesOf(alertIssues);
  if (!sites.length) {
    return null;
  }
  return (
    <a class="note warn link" href="#/sources">
      <b>{sites.length > 1 ? 'Des alertes à modifier sur les sites : ' : 'Une alerte à modifier sur le site : '}</b>
      {sites.join(', ')}
      {' — elle ne couvre pas vos réglages. Voir dans Sites →'}
    </a>
  );
};
