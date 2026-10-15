import { describe, expect, it } from 'vitest';
import { lintTemplate } from '../../../src/domain/messaging/lint.js';
import { render } from '../../../src/domain/messaging/render.js';
import { buildVars } from '../../../src/domain/messaging/variables.js';
import { type ExtractionContext, extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { garageDuLac } from '../../support/dealer.js';
import { rawListing } from '../../support/rawListing.js';

const context: ExtractionContext = { customBrands: [], currentYear: 2026 };

const raw = rawListing('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { site: 'leboncoin', siteLabel: 'Leboncoin', city: 'Pessac' });

describe("un gabarit rempli avec les données d'une annonce", () => {
  it("le message reprend le modèle, l'année, le site, le prénom et le téléphone de la concession", () => {
    // Given
    const vars = buildVars(raw, extractVehicleInfo(raw, context), garageDuLac, 12);

    // When
    const out = render('Bonjour, votre {modele} {annee} sur {site}. Je suis {prenom}. Tel {telephone}.', vars);

    // Then
    expect(out).toBe('Bonjour, votre Porsche 911 Carrera S 2015 sur Leboncoin. Je suis Jean. Tel 06 12 34 56 78.');
  });

  it('un gabarit qui cite le prix, le kilométrage et la distance les écrit « 89 900 € », « 42 000 km » et « 12 km », sans espace insécable', () => {
    // Given
    const vars = buildVars(raw, extractVehicleInfo(raw, context), garageDuLac, 12.4);

    // When
    const out = render('Votre {modele} à {prix} avec {km} km, à {distance} km de chez nous.', vars);

    // Then
    expect(out).toBe('Votre Porsche 911 Carrera S à 89 900 € avec 42 000 km, à 12 km de chez nous.');
  });

  it('une annonce sans kilométrage : la phrase qui le cite tombe, le reste du paragraphe reste', () => {
    // Given
    const noKm = { ...raw, title: 'Porsche 911 Carrera S 2015' };

    // When
    const out = render(
      'Je viens de voir votre {modele}. Une {modele} avec {km} km, ça part vite. On en parle ?',
      buildVars(noKm, extractVehicleInfo(noKm, context), garageDuLac, null),
    );

    // Then
    expect(out).toBe('Je viens de voir votre Porsche 911 Carrera S. On en parle ?');
  });

  it('une annonce sans kilométrage et une concession sans zone localisée : le paragraphe dont toutes les phrases tombent disparaît', () => {
    // Given
    const noKm = { ...raw, title: 'Porsche 911 Carrera S 2015' };
    const template = [
      'Bonjour,',
      '',
      "Votre {modele} {annee} m'intéresse.",
      '',
      "Une {modele} avec {km} km, c'est rare. Je suis à {distance} km de chez vous.",
      '',
      "Appelez-moi au {telephone}, je n'insisterai pas.",
    ].join('\n');

    // When
    const out = render(template, buildVars(noKm, extractVehicleInfo(noKm, context), garageDuLac, null));

    // Then
    expect(out).toBe("Bonjour,\n\nVotre Porsche 911 Carrera S 2015 m'intéresse.\n\nAppelez-moi au 06 12 34 56 78, je n'insisterai pas.");
  });

  it('la signature « {prenom} {nom} » reste à sa place même quand le nom manque', () => {
    // Given
    const dealerWithoutLastName = { ...garageDuLac, lastName: '' };
    const template = [
      "Je suis au {telephone}. Si ce n'est pas d'actualité, ne vous embêtez pas à répondre, je n'insisterai pas.",
      '',
      '{prenom} {nom}',
      '{concession}',
    ].join('\n');

    // When
    const out = render(template, buildVars(raw, extractVehicleInfo(raw, context), dealerWithoutLastName, 12));

    // Then
    expect(out).toBe(
      "Je suis au 06 12 34 56 78. Si ce n'est pas d'actualité, ne vous embêtez pas à répondre, je n'insisterai pas.\n\nJean\nGarage du Lac",
    );
  });

  it('comportement hérité : l’espace avant « : » et « ; » du gabarit disparaît au rendu, « grande phrase : si » devient « grande phrase: si »', () => {
    // Given
    const template = 'Je ne vais pas vous faire de grande phrase : si vous voulez vendre vite, on en parle ; je suis au {telephone}.';

    // When
    const out = render(template, buildVars(raw, extractVehicleInfo(raw, context), garageDuLac, 12));

    // Then
    expect(out).toBe('Je ne vais pas vous faire de grande phrase: si vous voulez vendre vite, on en parle; je suis au 06 12 34 56 78.');
  });

  it('comportement hérité : sans téléphone renseigné, « Appelez-moi au {telephone}, je n’insisterai pas. » tombe avec la mention qui met en règle, et la relecture du gabarit ne prévient pas', () => {
    // Given
    const dealerWithoutPhone = { ...garageDuLac, phone: '' };
    const template = 'Si ce n’est pas d’actualité, pas de souci. Appelez-moi au {telephone}, je n’insisterai pas.';

    // When
    const out = render(template, buildVars(raw, extractVehicleInfo(raw, context), dealerWithoutPhone, 12));
    const warnings = lintTemplate(template);

    // Then
    expect(out).toBe('Si ce n’est pas d’actualité, pas de souci.');
    expect(warnings).toEqual([]);
  });
});
