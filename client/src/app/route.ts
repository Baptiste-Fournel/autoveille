export type Route =
  | { readonly name: 'annonces' }
  | { readonly name: 'annonce'; readonly id: number }
  | { readonly name: 'rafale' }
  | { readonly name: 'reglages' }
  | { readonly name: 'messages' }
  | { readonly name: 'sources' };

export type ScreenName = Route['name'];

export const routeOf = (hash: string): Route => {
  const [name, argument] = hash.replace(/^#\/?/, '').split('/');
  switch (name) {
    case 'annonce':
      return { name, id: Number(argument) };
    case 'rafale':
    case 'reglages':
    case 'messages':
    case 'sources':
      return { name };
    default:
      return { name: 'annonces' };
  }
};

export const routeKeyOf = (route: Route): string => (route.name === 'annonce' ? `annonce/${route.id}` : route.name);
