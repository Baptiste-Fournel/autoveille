import type { JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { SiteDto, SourcesResponse } from '../../../../src/shared/api';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { useRefresh } from '../../app/useRefresh';
import { DirectSites } from './DirectSites';
import { MailboxCard } from './MailboxCard';
import { ReceivedEmails } from './ReceivedEmails';
import { SiteAlerts } from './SiteAlerts';

const keepScreenAsShown = (): void => undefined;

export const Sources = (): JSX.Element => {
  const { api, settings, toast } = useAppState();
  const [sources, setSources] = useState<SourcesResponse | null>(null);
  const draft = settings.draft.value;
  const savedDirectSites = settings.saved.value?.settings.httpSites.length ?? 0;

  const load = useCallback(async (): Promise<void> => {
    await settings.loadUnlessDirty();
    setSources(await api.sources());
  }, [api, settings]);

  useEffect(() => {
    load().catch(keepScreenAsShown);
  }, [load]);
  useRefresh(() => {
    load().catch(keepScreenAsShown);
  });

  const save = async (confirmation: string): Promise<boolean> => {
    const edited = settings.draft.value;
    if (edited === null) {
      return false;
    }
    try {
      await settings.save(edited);
      toast.show(confirmation);
      await load();
      return true;
    } catch (error) {
      toast.show(errorText(error), { error: true });
      return false;
    }
  };

  const mark = (site: SiteDto, done: boolean): void => {
    settings.edit((edited) => ({ ...edited, alertsDone: { ...edited.alertsDone, [site.key]: done } }));
    void save(done ? `Alerte ${site.label} notée comme créée` : 'Noté');
  };

  return (
    <>
      <div class="headline">
        <h1>Sites</h1>
        <p class="muted">D’où viennent les annonces, et comment vérifier que tout fonctionne.</p>
      </div>
      {sources === null || draft === null ? null : (
        <>
          <MailboxCard mailbox={sources.imap} imap={draft.imap} onSave={save} />
          <SiteAlerts sites={sources.sites} city={draft.zone.city} onMark={mark} />
          <ReceivedEmails emails={sources.emails} onReload={load} />
          <DirectSites sites={draft.httpSites} runs={sources.httpSites} savedCount={savedDirectSites} onSave={save} />
        </>
      )}
    </>
  );
};
