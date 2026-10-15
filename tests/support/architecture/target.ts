import { isBuiltin } from 'node:module';
import { posix } from 'node:path';

export type Target =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'nodeBuiltin'; readonly name: string }
  | { readonly kind: 'unresolvable' };

const isRelative = (specifier: string): boolean =>
  specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');

const packageName = (specifier: string): string => {
  const [scope, name] = specifier.split('/');
  return specifier.startsWith('@') && name !== undefined ? `${scope}/${name}` : (scope ?? specifier);
};

export const targetOf = (importerPath: string, specifier: string | undefined): Target => {
  if (specifier === undefined || specifier.startsWith('/')) {
    return { kind: 'unresolvable' };
  }
  if (isRelative(specifier)) {
    return { kind: 'file', path: posix.normalize(posix.join(posix.dirname(importerPath), specifier)) };
  }
  if (specifier.startsWith('node:') || isBuiltin(specifier)) {
    return { kind: 'nodeBuiltin', name: specifier };
  }
  return { kind: 'package', name: packageName(specifier) };
};
