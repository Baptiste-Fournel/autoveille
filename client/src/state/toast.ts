import { type ReadonlySignal, signal } from '@preact/signals';
import { errorText } from '../api/errorText';

const UNDO_DELAY_MS = 6000;

const ERROR_DELAY_MS = 5000;

const MESSAGE_DELAY_MS = 2600;

export type Undo = () => Promise<void>;

export interface ToastMessage {
  readonly text: string;
  readonly error: boolean;
  readonly undo: Undo | null;
  readonly visible: boolean;
}

export interface ToastOptions {
  readonly error?: boolean;
  readonly undo?: Undo;
}

export interface Toast {
  readonly current: ReadonlySignal<ToastMessage | null>;
  readonly show: (text: string, options?: ToastOptions) => void;
  readonly hide: () => void;
  readonly undo: () => Promise<void>;
}

const delayOf = (message: ToastMessage): number => {
  if (message.undo !== null) {
    return UNDO_DELAY_MS;
  }
  return message.error ? ERROR_DELAY_MS : MESSAGE_DELAY_MS;
};

export const createToast = (): Toast => {
  const current = signal<ToastMessage | null>(null);
  let hiding: ReturnType<typeof setTimeout> | undefined;

  const hide = (): void => {
    const shown = current.value;
    if (shown !== null) {
      current.value = { ...shown, visible: false };
    }
  };

  const show = (text: string, options: ToastOptions = {}): void => {
    const message: ToastMessage = { text, error: options.error === true, undo: options.undo ?? null, visible: true };
    current.value = message;
    clearTimeout(hiding);
    hiding = setTimeout(hide, delayOf(message));
  };

  return {
    current,
    show,
    hide,
    undo: async () => {
      const undo = current.value?.undo;
      hide();
      if (undo !== null && undo !== undefined) {
        await undo().catch((error: unknown) => show(errorText(error), { error: true }));
      }
    },
  };
};
