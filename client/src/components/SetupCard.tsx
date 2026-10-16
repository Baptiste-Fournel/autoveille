import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { OverviewResponse } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { MAIN_SITES } from '../sites/mainSites';
import { Icon } from './Icon';

const HIDDEN_ON_THIS_DEVICE = '1';

interface SetupStep {
  readonly ok: boolean;
  readonly label: string;
  readonly action: string;
  readonly destination: { readonly href: string } | { readonly activate: () => void };
}

const stepAction = (step: SetupStep): JSX.Element =>
  'href' in step.destination ? (
    <a class="btn small" href={step.destination.href}>
      {step.action}
    </a>
  ) : (
    <button class="btn small" type="button" onClick={step.destination.activate}>
      {step.action}
    </button>
  );

export const SetupCard = ({ overview }: { readonly overview: OverviewResponse }): JSX.Element | null => {
  const { preferences, push } = useAppState();
  const [hidden, setHidden] = useState(() => preferences.get('setup_hidden') === HIDDEN_ON_THIS_DEVICE);
  if (hidden) {
    return null;
  }
  const alertsDone = MAIN_SITES.filter((site) => overview.alertsDone.includes(site)).length;
  const steps: readonly SetupStep[] = [
    {
      ok: Boolean(overview.dealer.firstName && overview.dealer.phone),
      label: 'Votre nom et votre téléphone',
      action: 'Réglages',
      destination: { href: '#/reglages' },
    },
    { ok: overview.imapConfigured, label: 'La boîte mail des alertes', action: 'Sites', destination: { href: '#/sources' } },
    {
      ok: alertsDone >= MAIN_SITES.length,
      label: `Les alertes sur les sites (${alertsDone}/${MAIN_SITES.length})`,
      action: 'Sites',
      destination: { href: '#/sources' },
    },
    ...(push.possible
      ? [
          {
            ok: push.status.value === 'active',
            label: 'Les notifications sur cet appareil',
            action: 'Activer',
            destination: { activate: () => void push.enable() },
          },
        ]
      : []),
  ];
  const done = steps.filter((step) => step.ok).length;
  if (done === steps.length) {
    return null;
  }
  const hide = (): void => {
    preferences.set('setup_hidden', HIDDEN_ON_THIS_DEVICE);
    setHidden(true);
  };
  return (
    <section class="card setup">
      <div class="row between">
        <h2>
          Mise en route <span class="muted">{`${done}/${steps.length}`}</span>
        </h2>
        <button class="btn quiet small" type="button" title="Ne plus afficher sur cet appareil" onClick={hide}>
          Masquer
        </button>
      </div>
      <ul class="steps">
        {steps.map((step) => (
          <li key={step.label} class={step.ok ? 'done' : undefined}>
            <span class="tick">{step.ok ? <Icon name="check" /> : null}</span>
            <span class="label">{step.label}</span>
            {step.ok ? null : stepAction(step)}
          </li>
        ))}
      </ul>
    </section>
  );
};
