import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { json } from './support/fakeServer';
import { serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { porsche911Merignac } from './support/vehicles';

const RETOUCHED =
  'Bonjour, votre Porsche 911 Carrera S de 2015 m’intéresse, je peux passer la voir samedi. Concession Autos du Sud-Ouest, 06 12 34 56 78.';

const messageBox = (): HTMLElement => {
  const box = screen.getByRole('textbox', { name: 'Message à envoyer' }).closest('.message');
  if (!(box instanceof HTMLElement)) {
    throw new Error('Pas de message');
  }
  return box;
};

describe('message proposé sur la carte', () => {
  it('toucher « Lire la suite ou modifier » déplie le message de la Porsche, « Réduire » le replie', async () => {
    // Given
    await renderedApplication(serverWithLists({ nouveau: [porsche911Merignac()] }));
    const unfold = await screen.findByRole('button', { name: 'Lire la suite ou modifier' });
    const foldedAtFirst = messageBox().className;

    // When
    fireEvent.click(unfold);
    const unfolded = messageBox().className;
    fireEvent.click(screen.getByRole('button', { name: 'Réduire' }));

    // Then
    expect(foldedAtFirst).toBe('message collapsed');
    expect(unfolded).toBe('message');
    expect(messageBox().className).toBe('message collapsed');
    expect(screen.getByRole('textbox', { name: 'Message à envoyer' })).toHaveProperty(
      'value',
      'Bonjour, votre Porsche 911 Carrera S de 2015 m’intéresse. Concession Autos du Sud-Ouest, 06 12 34 56 78.',
    );
  });

  it('le message proposé pour la Porsche s’affiche avec le curseur au début, comme avant la refonte : une retouche commencée au clavier part du « Bonjour »', async () => {
    // Given
    const server = serverWithLists({ nouveau: [porsche911Merignac()] });

    // When
    await renderedApplication(server);

    // Then
    const message = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Message à envoyer' });
    expect({ start: message.selectionStart, end: message.selectionEnd }).toEqual({ start: 0, end: 0 });
  });

  it('le message retouché de la Porsche est enregistré en quittant le champ, et seulement s’il a changé', async () => {
    // Given
    const server = serverWithLists({ nouveau: [porsche911Merignac()] });
    server.on('POST', '/api/vehicles/12', () => json(200, porsche911Merignac({ message: RETOUCHED, messageEdited: true })));
    await renderedApplication(server);
    const message = await screen.findByRole('textbox', { name: 'Message à envoyer' });

    // When
    fireEvent.focus(message);
    fireEvent.blur(message);
    const afterReadingOnly = server.requestsTo('POST', '/api/vehicles/12').length;
    fireEvent.focus(message);
    fireEvent.input(message, { target: { value: RETOUCHED } });
    fireEvent.blur(message);

    // Then
    expect(afterReadingOnly).toBe(0);
    expect(messageBox().className).toBe('message');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Message enregistré'));
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([{ message: RETOUCHED }]);
    expect(screen.getByText('Message modifié').className).toBe('badge');
  });
});
