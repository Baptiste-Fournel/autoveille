import type { JSX } from 'preact';
import { Annonce } from '../screens/annonce/Annonce';
import { Annonces } from '../screens/annonces/Annonces';
import { Messages } from '../screens/messages/Messages';
import { Rafale } from '../screens/rafale/Rafale';
import { Reglages } from '../screens/reglages/Reglages';
import { Sources } from '../screens/sources/Sources';
import type { Route } from './route';

export const Screen = ({ route }: { readonly route: Route }): JSX.Element => {
  switch (route.name) {
    case 'annonce':
      return <Annonce id={route.id} />;
    case 'rafale':
      return <Rafale />;
    case 'reglages':
      return <Reglages />;
    case 'messages':
      return <Messages />;
    case 'sources':
      return <Sources />;
    default:
      return <Annonces />;
  }
};
