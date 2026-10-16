import type { JSX } from 'preact';
import type { Family, FamilyRulesDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import { NumberInput } from '../../components/NumberInput';
import { ChipList } from './ChipList';
import { shownBrands, withBrandAdded, withBrandToggled, withFamilyRules, withKeywordAdded, withoutKeyword } from './familyRulesEdits';

export interface FamilyRulesProps {
  readonly family: Family;
  readonly label: string;
  readonly rules: FamilyRulesDto;
  readonly specialOnly: boolean;
}

export const FamilyRules = ({ family, label, rules, specialOnly }: FamilyRulesProps): JSX.Element => {
  const { settings } = useAppState();
  const change = (edit: (current: FamilyRulesDto) => FamilyRulesDto): void =>
    settings.edit((draft) => withFamilyRules(draft, family, edit));
  return (
    <div class="family" data-enabled={String(rules.enabled)}>
      <div class="fhead">
        <h3>{label}</h3>
        <button
          class="toggle"
          role="switch"
          type="button"
          aria-checked={rules.enabled}
          onClick={() => change((current) => ({ ...current, enabled: !current.enabled }))}
        />
      </div>
      <div class="fbody">
        <ChipList
          items={shownBrands(rules)}
          pressed={(brand) => rules.brands.includes(brand)}
          onToggle={(brand) => change((current) => withBrandToggled(current, brand))}
          addLabel="Ajouter une marque"
          onAdd={(brand) => change((current) => withBrandAdded(current, brand))}
        />
        <details class={specialOnly ? 'adv' : 'adv hidden'}>
          <summary>Règle supercar et collection</summary>
          <div class="body">
            <div class="grid2">
              <Field label="Prix à partir duquel on garde" help="0 pour ne pas tenir compte du prix.">
                {(id) => (
                  <div class="input-affix">
                    <NumberInput
                      id={id}
                      value={rules.minPrice}
                      min={0}
                      step={5000}
                      onValue={(minPrice) => change((current) => ({ ...current, minPrice }))}
                    />
                    <span>€</span>
                  </div>
                )}
              </Field>
              <Field label="Ou année jusqu’à" help="Les voitures de cette année ou plus anciennes sont gardées. 0 pour ignorer.">
                {(id) => (
                  <NumberInput
                    id={id}
                    value={rules.maxYear}
                    min={0}
                    max={2100}
                    onValue={(maxYear) => change((current) => ({ ...current, maxYear }))}
                  />
                )}
              </Field>
            </div>
            <Field label="Ou modèles et mots-clés" help="Un mot-clé présent dans le titre de l’annonce suffit à garder la voiture.">
              {(id) => (
                <ChipList
                  id={id}
                  items={rules.keywords}
                  addLabel="Ajouter un mot-clé"
                  onAdd={(keyword) => change((current) => withKeywordAdded(current, keyword))}
                  onRemove={(keyword) => change((current) => withoutKeyword(current, keyword))}
                />
              )}
            </Field>
          </div>
        </details>
      </div>
    </div>
  );
};
