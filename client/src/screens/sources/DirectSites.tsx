import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { HttpSiteDto, HttpSiteStateDto, HttpSiteTestResponse } from '../../../../src/shared/api';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import { ago } from '../../format/ago';
import { sampleListingLine } from './listingLine';
import { RunStatus } from './RunStatus';

type PageCheck = { readonly running: true } | { readonly running: false; readonly result: HttpSiteTestResponse };

const SAMPLE_STYLE = { margin: '6px 0 0', paddingLeft: '18px' } as const;

const ID_RADIX = 36;

const ID_LENGTH = 8;

const newHttpSiteId = (): string =>
  Math.random()
    .toString(ID_RADIX)
    .slice(2, 2 + ID_LENGTH);

const PageCheckMessage = ({ check }: { readonly check: PageCheck | null }): JSX.Element | null => {
  if (check === null) {
    return null;
  }
  if (check.running) {
    return <span class="muted small">Lecture en cours…</span>;
  }
  const { ok, detail, sample } = check.result;
  return (
    <div class={`note ${ok ? 'ok' : 'warn'}`}>
      {detail}
      {sample?.length ? (
        <ul style={SAMPLE_STYLE}>
          {sample.map((listing) => (
            <li key={listing.url}>{sampleListingLine(listing)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

interface DirectSiteProps {
  readonly site: HttpSiteDto;
  readonly run: HttpSiteStateDto['lastRun'] | undefined;
  readonly onRemove: () => void;
}

const DirectSite = ({ site, run, onRemove }: DirectSiteProps): JSX.Element => {
  const { refresh } = useAppState();
  return (
    <div class="site">
      <div class="shead">
        <h3>{site.name}</h3>
        <div class="row">
          <RunStatus run={run} />
          <button class="btn quiet small danger" type="button" onClick={onRemove}>
            Retirer
          </button>
        </div>
      </div>
      <p class="small muted ellip">{site.url}</p>
      {run ? <p class="small">{`${ago(run.last_run_at, refresh.now.value)} : ${run.detail}`}</p> : null}
    </div>
  );
};

export interface DirectSitesProps {
  readonly sites: readonly HttpSiteDto[];
  readonly runs: readonly HttpSiteStateDto[];
  readonly savedCount: number;
  readonly onSave: (confirmation: string) => Promise<boolean>;
}

export const DirectSites = ({ sites, runs, savedCount, onSave }: DirectSitesProps): JSX.Element => {
  const { api, settings, toast } = useAppState();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [check, setCheck] = useState<PageCheck | null>(null);

  const test = async (): Promise<void> => {
    setCheck({ running: true });
    try {
      setCheck({ running: false, result: await api.testHttpSite({ url }) });
    } catch (error) {
      setCheck({ running: false, result: { ok: false, detail: errorText(error) } });
    }
  };

  const add = async (): Promise<void> => {
    if (!url) {
      toast.show('Indiquez l’adresse de la page.', { error: true });
      return;
    }
    const added: HttpSiteDto = { id: newHttpSiteId(), name: name || 'Site', url, enabled: true };
    settings.edit((draft) => ({ ...draft, httpSites: [...draft.httpSites, added] }));
    if (await onSave('Site ajouté')) {
      setName('');
      setUrl('');
      setCheck(null);
    }
  };

  const remove = (removed: number): void =>
    settings.edit((draft) => ({ ...draft, httpSites: draft.httpSites.filter((_, index) => index !== removed) }));

  return (
    <details class="adv card section" open={savedCount > 0}>
      <summary>Avancé : un site sans alerte email</summary>
      <div class="body">
        <section class="section">
          <h2>Un site sans alerte email</h2>
          <p class="muted small">
            Réservé aux sites qui ne proposent pas d’alerte : collez l’adresse d’une page de résultats de recherche. L’application la relit
            toutes les 30 minutes, seulement si le site autorise la lecture automatique (sinon elle vous le dit).
          </p>
          <div class="stack">
            {sites.map((site, index) => (
              <DirectSite
                key={site.id}
                site={site}
                run={runs.find((candidate) => candidate.id === site.id)?.lastRun}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
          <div class="grid2">
            <Field label="Nom du site">
              {(id) => (
                <input
                  class="input"
                  id={id}
                  placeholder="Annonces-Automobile"
                  value={name}
                  onInput={(event) => setName(event.currentTarget.value)}
                />
              )}
            </Field>
            <Field label="Adresse de la page de résultats">
              {(id) => (
                <input
                  class="input"
                  id={id}
                  type="url"
                  placeholder="https://…"
                  value={url}
                  onInput={(event) => setUrl(event.currentTarget.value)}
                />
              )}
            </Field>
          </div>
          <div class="row">
            <button class="btn" type="button" onClick={() => void test()}>
              Tester cette page
            </button>
            <button class="btn primary" type="button" onClick={() => void add()}>
              Ajouter ce site
            </button>
          </div>
          <div>
            <PageCheckMessage check={check} />
          </div>
          {sites.length || savedCount ? (
            <div>
              <button class="btn small" type="button" onClick={() => void onSave('Enregistré')}>
                Enregistrer les sites
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </details>
  );
};
