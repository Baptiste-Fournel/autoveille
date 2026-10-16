import { onTestFinished, vi } from 'vitest';

export interface ListingTabOptions {
  readonly blocked?: boolean;
  readonly openerLocked?: boolean;
  readonly copyRefused?: boolean;
}

const openedTab = (openerLocked: boolean, steps: string[]): Window => {
  if (!openerLocked) {
    return { opener: window } as Window;
  }
  return Object.defineProperty({}, 'opener', {
    get: () => window,
    set: () => {
      steps.push('opener en lecture seule');
      throw new TypeError('Cannot assign to read only property opener');
    },
  }) as Window;
};

const stubbed = (target: object, name: string, value: unknown): void => {
  Object.defineProperty(target, name, { value, configurable: true });
  onTestFinished(() => {
    Reflect.deleteProperty(target, name);
  });
};

export const browserOpeningListings = ({
  blocked = false,
  openerLocked = false,
  copyRefused = false,
}: ListingTabOptions = {}): readonly string[] => {
  const steps: string[] = [];
  stubbed(window.navigator, 'clipboard', {
    writeText: (text: string) => {
      steps.push(`copie : ${text}`);
      return copyRefused ? Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')) : Promise.resolve();
    },
  });
  stubbed(document, 'execCommand', (command: string) => {
    steps.push(`copie de secours : ${command}`);
    return !copyRefused;
  });
  const open = vi.spyOn(window, 'open').mockImplementation((url) => {
    steps.push(`ouverture : ${String(url)}`);
    return blocked ? null : openedTab(openerLocked, steps);
  });
  onTestFinished(() => open.mockRestore());
  return steps;
};

export const isShown = (element: Element): boolean => element.closest('.hidden') === null;
