import { createPortal, type JSX } from 'preact';
import { useAppState } from '../app/AppContext';
import type { ToastMessage } from '../state/toast';

const UNDO_TEXT = 'Annuler';

const classOf = (message: ToastMessage): string => {
  if (!message.visible) {
    return '';
  }
  return ['show', message.error ? 'error' : null, message.undo !== null ? 'with-undo' : null].filter(Boolean).join(' ');
};

export const Toast = (): JSX.Element => {
  const { toast } = useAppState();
  const message = toast.current.value;
  return createPortal(
    <div id="toast" role="status" aria-live="polite" class={message === null ? undefined : classOf(message)}>
      {message?.text}
      {message?.undo ? (
        <button class="undo" type="button" onClick={() => void toast.undo()}>
          {UNDO_TEXT}
        </button>
      ) : null}
    </div>,
    document.body,
  );
};
