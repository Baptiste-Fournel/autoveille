import type { Answer } from './fakeServer';

export interface HeldAnswer {
  readonly answer: Answer;
  readonly release: (response: Response) => void;
}

export const heldAnswer = (): HeldAnswer => {
  const waiting: ((response: Response) => void)[] = [];
  return {
    answer: () =>
      new Promise<Response>((resolve) => {
        waiting.push(resolve);
      }),
    release: (response) => {
      for (const resolve of waiting.splice(0)) {
        resolve(response);
      }
    },
  };
};
