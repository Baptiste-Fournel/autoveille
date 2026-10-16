import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { useSettingsDraft } from '../../app/useSettingsDraft';
import { DealerSection } from './DealerSection';
import { DisplaySection } from './DisplaySection';
import { FamiliesSection } from './FamiliesSection';
import { NotificationsSection } from './NotificationsSection';
import { PreviewCount } from './PreviewCount';
import { useSettingsPreview } from './useSettingsPreview';
import { ZoneSection } from './ZoneSection';

const SAVED_TEXT = 'Réglages enregistrés';

export const Reglages = (): JSX.Element => {
  const { settings, toast } = useAppState();
  const loaded = useSettingsDraft();
  const { preview, show } = useSettingsPreview(loaded?.draft ?? null);
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    const draft = settings.draft.value;
    if (draft === null) {
      return;
    }
    setSaving(true);
    try {
      const answer = await settings.save(draft);
      show(answer.preview);
      if (answer.warning) {
        toast.show(answer.warning, { error: true });
      } else {
        toast.show(SAVED_TEXT);
      }
    } catch (error) {
      toast.show(errorText(error), { error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div class="headline">
        <h1>Réglages</h1>
        <p class="muted">Le compteur en bas se met à jour à chaque changement, avant même d’enregistrer.</p>
      </div>
      {loaded === null ? null : (
        <>
          <DealerSection dealer={loaded.draft.dealer} />
          <ZoneSection draft={loaded.draft} />
          <FamiliesSection families={loaded.saved.families} draft={loaded.draft} />
          <NotificationsSection notifications={loaded.draft.notifications} />
          <DisplaySection />
          <div class="savebar">
            <PreviewCount preview={preview} />
            <button
              class="btn primary"
              id="save-settings"
              type="button"
              disabled={saving || !settings.dirty.value}
              onClick={() => void save()}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </>
  );
};
