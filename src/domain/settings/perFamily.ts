import type { Family } from '../catalog/families.js';

export const perFamily = <T>(build: (family: Family) => T): Readonly<Record<Family, T>> => ({
  allemandes: build('allemandes'),
  italiennes: build('italiennes'),
  americaines: build('americaines'),
  francaises: build('francaises'),
  autres: build('autres'),
});
