import type { JSX } from 'preact';
import { errorText } from '../../api/errorText';
import { useAppState } from '../../app/AppContext';
import { useSettingsDraft } from '../../app/useSettingsDraft';
import { TemplateVariant } from './TemplateVariant';
import { withVariantAdded } from './templateVariantsEdits';

const INTRODUCTION =
  'Un message par famille de marques, avec plusieurs variantes tirées au hasard pour ne pas envoyer toujours le même texte. Les accolades sont remplacées automatiquement.';

const WRITING_ADVICE = 'Écrivez comme vous parlez. Pas de tiret long, pas d’émoji, pas de formule toute faite : l’aperçu vous le signale.';

const SAVED_TEXT = 'Messages enregistrés';

export const Messages = (): JSX.Element => {
  const { settings, toast, messagesFamily } = useAppState();
  const loaded = useSettingsDraft();
  const family = messagesFamily.value ?? loaded?.saved.families[0]?.key;

  const save = async (): Promise<void> => {
    const draft = settings.draft.value;
    if (draft === null) {
      return;
    }
    try {
      await settings.save(draft);
      toast.show(SAVED_TEXT);
    } catch (error) {
      toast.show(errorText(error), { error: true });
    }
  };

  return (
    <>
      <div class="headline">
        <h1>Messages</h1>
        <p class="muted">{INTRODUCTION}</p>
      </div>
      {loaded === null || family === undefined ? null : (
        <>
          <div class="filterbar">
            {loaded.saved.families.map(({ key, label }) => (
              <button
                key={key}
                class="chip"
                type="button"
                aria-pressed={key === family}
                onClick={() => {
                  messagesFamily.value = key;
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div class="note">{WRITING_ADVICE}</div>
          <div class="stack">
            {loaded.draft.templates[family].variants.map((text, index, variants) => (
              <TemplateVariant
                key={`${family}-${variants.length}-${index}`}
                family={family}
                index={index}
                text={text}
                removable={variants.length > 1}
                variables={loaded.saved.variables}
              />
            ))}
            <button class="btn" type="button" onClick={() => settings.edit((draft) => withVariantAdded(draft, family))}>
              + Ajouter une variante
            </button>
          </div>
          <div class="savebar">
            <div class="count">
              <span>Les messages déjà retouchés sur une annonce ne changent pas.</span>
            </div>
            <button class="btn primary" id="save-settings" type="button" disabled={!settings.dirty.value} onClick={() => void save()}>
              Enregistrer
            </button>
          </div>
        </>
      )}
    </>
  );
};
