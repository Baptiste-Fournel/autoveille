import { batch, useSignal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { VehicleDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { useRefresh } from '../../app/useRefresh';
import { Icon } from '../../components/Icon';
import { VehicleSheet } from '../../components/VehicleSheet';
import { plural } from '../../format/plural';
import type { BurstProgress } from '../../state/burst';
import { actedInBurst, isOver, purgedBurst, skippedInBurst, startedBurst, undoneInBurst } from './burstProgress';
import { vehiclesToHandle } from './vehiclesToHandle';

const LIST_HASH = '#/annonces';

const ONE_AT_A_TIME_TEXT = 'Une annonce à la fois : ouvrir, coller le message, envoyer, revenir. Chaque envoi reste le vôtre.';

const summaryOf = ({ sent, ignored, skipped }: BurstProgress): string =>
  `${plural(sent, 'message envoyé', 'messages envoyés')}, ${plural(ignored, 'annonce ignorée', 'annonces ignorées')}${
    skipped ? `, ${plural(skipped, 'passée', 'passées')}` : ''
  }.`;

const Finished = ({ progress, onStop }: { readonly progress: BurstProgress; readonly onStop: () => void }): JSX.Element => {
  const total = progress.sent + progress.ignored + progress.skipped;
  return (
    <div class="empty">
      <Icon name="bolt" />
      <b>{total ? 'Rafale terminée' : 'Rien à traiter'}</b>
      <p>{total ? summaryOf(progress) : 'Toutes les annonces sont traitées.'}</p>
      <button class="btn primary" type="button" onClick={onStop}>
        Retour aux annonces
      </button>
    </div>
  );
};

const Progress = ({ progress, onStop }: { readonly progress: BurstProgress; readonly onStop: () => void }): JSX.Element => (
  <div class="progress">
    <div class="row between">
      <b>{`${progress.index + 1} sur ${progress.ids.length}`}</b>
      <button class="btn quiet small" type="button" onClick={onStop}>
        Arrêter
      </button>
    </div>
    <div class="bar">
      <div class="fill" style={{ width: `${Math.round((progress.index / progress.ids.length) * 100)}%` }} />
    </div>
  </div>
);

const withSnapshots = (known: ReadonlyMap<number, VehicleDto> | null, fresh: readonly VehicleDto[]): ReadonlyMap<number, VehicleDto> =>
  new Map([...(known ?? new Map<number, VehicleDto>()), ...fresh.map((vehicle) => [vehicle.id, vehicle] as const)]);

export const Rafale = (): JSX.Element => {
  const { api, burst, router } = useAppState();
  const known = useSignal<ReadonlyMap<number, VehicleDto> | null>(null);

  const load = async (): Promise<void> => {
    try {
      const toHandle = await vehiclesToHandle(api);
      const snapshots = withSnapshots(known.value, toHandle);
      const progress = burst.value;
      batch(() => {
        known.value = snapshots;
        burst.value = progress?.ids.length
          ? purgedBurst(progress, new Set(toHandle.map((vehicle) => vehicle.id)), new Set(snapshots.keys()))
          : startedBurst(toHandle.map((vehicle) => vehicle.id));
      });
    } catch {
      return;
    }
  };

  useEffect(() => {
    void load();
  }, []);
  useRefresh(() => void load());

  const move = (next: (progress: BurstProgress) => BurstProgress): void => {
    const progress = burst.value;
    if (progress !== null) {
      burst.value = next(progress);
      window.scrollTo({ top: 0 });
    }
  };

  const stop = (): void => {
    burst.value = null;
    router.navigate(LIST_HASH);
  };

  const keepMessage = (saved: VehicleDto): void => {
    const snapshots = known.value;
    const shown = snapshots?.get(saved.id);
    if (snapshots !== null && shown !== undefined) {
      known.value = new Map([...snapshots, [saved.id, { ...shown, message: saved.message, messageEdited: saved.messageEdited }]]);
    }
  };

  const progress = burst.value;
  const snapshots = known.value;
  const currentId = progress?.ids[progress.index];
  const current = currentId === undefined ? undefined : snapshots?.get(currentId);

  const step = (): JSX.Element | null => {
    if (progress === null || snapshots === null) {
      return null;
    }
    if (isOver(progress)) {
      return <Finished progress={progress} onStop={stop} />;
    }
    if (current === undefined) {
      return null;
    }
    return (
      <>
        <Progress progress={progress} onStop={stop} />
        <VehicleSheet
          key={current.id}
          vehicle={current}
          burst={{ onSkip: () => move(skippedInBurst) }}
          onActed={(change) => move((shown) => actedInBurst(shown, change))}
          onUndone={(change) => move((shown) => undoneInBurst(shown, change))}
          onMessageSaved={keepMessage}
        />
      </>
    );
  };

  return (
    <>
      <div class="headline">
        <h1>Mode rafale</h1>
        <p class="muted">{ONE_AT_A_TIME_TEXT}</p>
      </div>
      <div class="stack">{step()}</div>
    </>
  );
};
