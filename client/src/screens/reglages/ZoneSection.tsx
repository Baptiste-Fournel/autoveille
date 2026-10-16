import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import type { SettingsDto, ZoneDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import { NumberInput } from '../../components/NumberInput';
import { Switch } from './Switch';

const RADIUS = { min: 25, max: 250, step: 25 } as const;

const SPECIAL_ONLY_HELP =
  'Garde une voiture si elle dépasse le prix plancher, si elle est assez ancienne, ou si son modèle est dans la liste de la famille. Réglable famille par famille ci-dessous.';

export const ZoneSection = ({ draft }: { readonly draft: SettingsDto }): JSX.Element => {
  const { settings } = useAppState();
  const radiusId = useId();
  const writeZone = (change: Partial<Pick<ZoneDto, 'city' | 'postalCode' | 'radiusKm'>>): void =>
    settings.edit((current) => ({ ...current, zone: { ...current.zone, ...change } }));
  return (
    <section class="card section">
      <h2>Zone</h2>
      <div class="grid2">
        <Field label="Ville de référence">
          {(id) => (
            <input
              class="input"
              id={id}
              value={draft.zone.city}
              placeholder="Bordeaux"
              onInput={(event) => writeZone({ city: event.currentTarget.value })}
            />
          )}
        </Field>
        <Field label="Code postal (facultatif)" help="Utile si la ville porte un nom courant.">
          {(id) => (
            <input
              class="input"
              id={id}
              value={draft.zone.postalCode}
              inputmode="numeric"
              placeholder="33000"
              onInput={(event) => writeZone({ postalCode: event.currentTarget.value })}
            />
          )}
        </Field>
      </div>
      <div class="field">
        <div class="row between">
          <label for={radiusId}>Rayon autour de la ville</label>
          <b>{`${draft.zone.radiusKm} km`}</b>
        </div>
        <input
          class="slider"
          id={radiusId}
          type="range"
          min={RADIUS.min}
          max={RADIUS.max}
          step={RADIUS.step}
          value={String(draft.zone.radiusKm)}
          onInput={(event) => writeZone({ radiusKm: Number(event.currentTarget.value) })}
        />
      </div>
      <Field label="Kilométrage maximum" help="Les annonces sans kilométrage indiqué sont gardées.">
        {(id) => (
          <div class="input-affix">
            <NumberInput
              id={id}
              value={draft.maxKm}
              min={0}
              step={5000}
              onValue={(maxKm) => settings.edit((current) => ({ ...current, maxKm }))}
            />
            <span>km</span>
          </div>
        )}
      </Field>
      <div>
        <Switch
          title="Particuliers uniquement"
          help="Écarte les annonces de professionnels quand le site le précise."
          on={draft.privateOnly}
          onToggle={() => settings.edit((current) => ({ ...current, privateOnly: !current.privateOnly }))}
        />
        <Switch
          title="Supercar et collection uniquement"
          help={SPECIAL_ONLY_HELP}
          on={draft.specialOnly}
          onToggle={() => settings.edit((current) => ({ ...current, specialOnly: !current.specialOnly }))}
        />
      </div>
    </section>
  );
};
