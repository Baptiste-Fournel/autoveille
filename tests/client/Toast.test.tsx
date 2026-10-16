import { act, fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../client/src/app/App';
import { fakeServer } from './support/fakeServer';
import { applicationState } from './support/testApplication';

const toastElement = (): HTMLElement | null => document.getElementById('toast');

describe('confirmation en bas d’écran', () => {
  it('« Annuler » reste six secondes après un changement de statut, puis la confirmation disparaît', () => {
    // Given
    vi.useFakeTimers();
    const state = applicationState(fakeServer());
    render(<App state={state} />);
    act(() => state.toast.show('Passée en « contactée »', { undo: async () => undefined }));

    // When
    act(() => {
      vi.advanceTimersByTime(5999);
    });
    const justBefore = toastElement()?.className;
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Then
    expect(justBefore).toBe('show with-undo');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(toastElement()?.className).toBe('');
  });

  it('« Annonce introuvable. » en erreur reste cinq secondes, puis disparaît', () => {
    // Given
    vi.useFakeTimers();
    const state = applicationState(fakeServer());
    render(<App state={state} />);
    act(() => state.toast.show('Annonce introuvable.', { error: true }));

    // When
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    const justBefore = toastElement()?.className;
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Then
    expect(justBefore).toBe('show error');
    expect(toastElement()?.className).toBe('');
  });

  it('« Message enregistré » disparaît après 2,6 secondes', () => {
    // Given
    vi.useFakeTimers();
    const state = applicationState(fakeServer());
    render(<App state={state} />);
    act(() => state.toast.show('Message enregistré'));

    // When
    act(() => {
      vi.advanceTimersByTime(2599);
    });
    const justBefore = toastElement()?.className;
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Then
    expect(justBefore).toBe('show');
    expect(toastElement()?.className).toBe('');
  });

  it('toucher « Annuler » masque aussitôt la confirmation et lance le retour en arrière', async () => {
    // Given
    const state = applicationState(fakeServer());
    const undo = vi.fn(async () => undefined);
    render(<App state={state} />);
    act(() => state.toast.show('Annonce ignorée', { undo }));

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    // Then
    expect(toastElement()?.className).toBe('');
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
