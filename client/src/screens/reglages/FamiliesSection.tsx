import type { JSX } from 'preact';
import type { FamilyChoiceDto, SettingsDto } from '../../../../src/shared/api';
import { FamilyRules } from './FamilyRules';

export interface FamiliesSectionProps {
  readonly families: readonly FamilyChoiceDto[];
  readonly draft: SettingsDto;
}

export const FamiliesSection = ({ families, draft }: FamiliesSectionProps): JSX.Element => (
  <section class="section">
    <h2>Marques suivies</h2>
    <p class="muted small">
      Touchez une marque pour l’activer ou la désactiver. Les mots-clés servent à reconnaître les versions sportives et de collection.
    </p>
    {families.map(({ key, label }) => (
      <FamilyRules key={key} family={key} label={label} rules={draft.families[key]} specialOnly={draft.specialOnly} />
    ))}
  </section>
);
