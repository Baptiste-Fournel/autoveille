import { describe, expect, it } from 'vitest';
import { lintTemplate } from '../../../src/domain/messaging/lint.js';
import { TEMPLATE_WARNING_TEXTS } from '../../../src/domain/presentation/templateWarnings.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';

const settings = defaultSettings();

describe("la relecture d'un gabarit de message avant de l'enregistrer", () => {
  it('chaque variante livrée par défaut passe la relecture', () => {
    // Given
    const families = ['allemandes', 'italiennes', 'americaines', 'francaises'] as const;
    const variants = families.flatMap((family) => settings.templates[family].variants);

    // When
    const warnings = variants.map(lintTemplate);

    // Then
    for (const found of warnings) expect(found).toEqual([]);
  });

  it("un message avec un tiret long, un émoji et « n'hésitez pas » reçoit trois avertissements", () => {
    // Given
    const text = "Bonjour — n'hésitez pas 🙂 {telephone}, je n'insisterai pas.";

    // When
    const warnings = lintTemplate(text);

    // Then
    expect(warnings.length).toBe(3);
  });

  it("un message sans téléphone ni « je n'insisterai pas » est signalé ; « je ne reviendrai pas vers vous » suffit", () => {
    // Given
    const withoutContactOrOptOut = 'Bonjour, votre {modele} est belle.';
    const withPhoneAndOptOut = 'Appelez-moi au {telephone}. Sinon je ne reviendrai pas vers vous.';

    // When
    const w = lintTemplate(withoutContactOrOptOut).map((warning) => TEMPLATE_WARNING_TEXTS[warning]);

    // Then
    expect(w.some((x) => /joindre/.test(x))).toBe(true);
    expect(w.some((x) => /insisterez pas/.test(x))).toBe(true);
    expect(lintTemplate(withPhoneAndOptOut)).toEqual([]);
  });

  it('un gabarit qui présente la reprise et le dépôt-vente en liste à puces est signalé', () => {
    // Given
    const text = [
      'Bonjour,',
      '',
      'Votre {modele} m’intéresse. Je vous propose :',
      '- une reprise ferme sous quelques jours ;',
      '- ou un dépôt-vente chez nous.',
      '',
      'Appelez-moi au {telephone}, je n’insisterai pas.',
    ].join('\n');

    // When
    const warnings = lintTemplate(text).map((warning) => TEMPLATE_WARNING_TEXTS[warning]);

    // Then
    expect(warnings).toEqual(['Contient une liste à puces.']);
  });

  it('« Je reste à votre entière disposition » est repérée comme une formule toute faite', () => {
    // Given
    const text = "Bonjour, votre {modele} m'intéresse. Je reste à votre entière disposition au {telephone}, je n'insisterai pas.";

    // When
    const warnings = lintTemplate(text).map((warning) => TEMPLATE_WARNING_TEXTS[warning]);

    // Then
    expect(warnings).toEqual(["Formule toute faite repérée (« n'hésitez pas », « je me permets »…), à reformuler."]);
  });

  it('un numéro écrit en clair dans le gabarit, sans la variable {telephone}, suffit pour être joint', () => {
    // Given
    const text = "Bonjour, votre {modele} m'intéresse. Appelez-moi au 06.12.34.56.78, je n'insisterai pas.";

    // When
    const warnings = lintTemplate(text);

    // Then
    expect(warnings).toEqual([]);
  });
});
