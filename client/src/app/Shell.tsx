import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from '../components/Icon';
import { ThemeButton } from '../theme/ThemeButton';
import { useAppState } from './AppContext';
import type { Route, ScreenName } from './route';

interface NavigationItem {
  readonly screen: ScreenName;
  readonly label: string;
  readonly icon: IconName;
  readonly counted: boolean;
}

const NAVIGATION: readonly NavigationItem[] = [
  { screen: 'annonces', label: 'Annonces', icon: 'car', counted: true },
  { screen: 'reglages', label: 'Réglages', icon: 'sliders', counted: false },
  { screen: 'messages', label: 'Messages', icon: 'chat', counted: false },
  { screen: 'sources', label: 'Sites', icon: 'inbox', counted: false },
];

const activeScreenOf = (route: Route): ScreenName => (route.name === 'annonce' || route.name === 'rafale' ? 'annonces' : route.name);

export const Shell = ({ children }: { readonly children: ComponentChildren }): JSX.Element => {
  const { overview, router } = useAppState();
  const count = overview.data.value?.counts.nouveau || 0;
  const active = activeScreenOf(router.route.value);
  const badge = (item: NavigationItem): JSX.Element | null => (item.counted && count ? <span class="badge count">{count}</span> : null);
  const current = (item: NavigationItem): 'page' | undefined => (active === item.screen ? 'page' : undefined);
  return (
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <Icon name="logo" />
          AutoVeille
        </div>
        <div class="topbar-right">
          <nav class="nav" aria-label="Navigation">
            {NAVIGATION.map((item) => (
              <a key={item.screen} href={`#/${item.screen}`} aria-current={current(item)}>
                {item.label}
                {badge(item)}
              </a>
            ))}
          </nav>
          <ThemeButton />
        </div>
      </header>
      <main class="view">{children}</main>
      <nav class="tabbar" aria-label="Navigation">
        {NAVIGATION.map((item) => (
          <a key={item.screen} href={`#/${item.screen}`} aria-current={current(item)}>
            <Icon name={item.icon} />
            {item.label}
            {badge(item)}
          </a>
        ))}
      </nav>
    </div>
  );
};
