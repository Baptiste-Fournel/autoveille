export type Location =
  | { readonly area: 'domain' }
  | { readonly area: 'application' }
  | { readonly area: 'infrastructure'; readonly zone: string }
  | { readonly area: 'shared' }
  | { readonly area: 'cli' }
  | { readonly area: 'main' }
  | { readonly area: 'otherSource' }
  | { readonly area: 'client' }
  | { readonly area: 'public' }
  | { readonly area: 'tests' }
  | { readonly area: 'outside' };

const sourceExtension = /\.[cm]?[jt]sx?$/;

export const withoutExtension = (path: string): string => path.replace(sourceExtension, '');

export const isTestFile = (path: string): boolean => path.startsWith('tests/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);

export const isInSource = (location: Location): boolean =>
  ['domain', 'application', 'infrastructure', 'shared', 'cli', 'main', 'otherSource'].includes(location.area);

const sourceLocation = (path: string, layer: string | undefined, child: string | undefined): Location => {
  if (withoutExtension(path) === 'src/main') {
    return { area: 'main' };
  }
  if (child === undefined) {
    return { area: 'otherSource' };
  }
  switch (layer) {
    case 'domain':
    case 'application':
    case 'shared':
    case 'cli':
      return { area: layer };
    case 'infrastructure':
      return { area: 'infrastructure', zone: withoutExtension(child) };
    default:
      return { area: 'otherSource' };
  }
};

export const locate = (path: string): Location => {
  const [root, layer, child] = path.split('/');
  switch (root) {
    case 'src':
      return sourceLocation(path, layer, child);
    case 'client':
      return { area: 'client' };
    case 'public':
      return { area: 'public' };
    case 'tests':
      return { area: 'tests' };
    default:
      return { area: 'outside' };
  }
};
