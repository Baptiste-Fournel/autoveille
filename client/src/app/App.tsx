import type { JSX } from 'preact';
import { Toast } from '../components/Toast';
import { Connexion } from '../screens/connexion/Connexion';
import type { AppState } from '../state/appState';
import { AppContext, useAppState } from './AppContext';
import { Screen } from './Screen';
import { Shell } from './Shell';

const SignedInOrNot = (): JSX.Element | null => {
  const { session, router } = useAppState();
  const me = session.me.value;
  if (me === null) {
    return null;
  }
  if (!me.authenticated) {
    return <Connexion />;
  }
  return (
    <Shell>
      <Screen route={router.route.value} />
    </Shell>
  );
};

export const App = ({ state }: { readonly state: AppState }): JSX.Element => (
  <AppContext.Provider value={state}>
    <SignedInOrNot />
    <Toast />
  </AppContext.Provider>
);
