import type { JSX } from 'preact';
import type { VehicleDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { VehicleSheet } from '../../components/VehicleSheet';
import { isSameVehicleId } from '../../state/vehicleSheet';

const LIST_HASH = '#/annonces';

const REMOVAL_QUESTION = 'Supprimer cette annonce de l’application ? Elle reviendra si un site la renvoie.';

const Missing = (): JSX.Element => (
  <div class="empty">
    <b>Annonce introuvable</b>
    <a class="btn" href={LIST_HASH}>
      Retour aux annonces
    </a>
  </div>
);

export const Annonce = ({ id }: { readonly id: number }): JSX.Element | null => {
  const { sheet, changes, toast, router } = useAppState();
  const shown = sheet.current.value;
  if (shown === null || !isSameVehicleId(shown.id, id)) {
    return null;
  }
  if (shown.missing) {
    return <Missing />;
  }
  const vehicle = shown.vehicle;
  if (vehicle === null) {
    return null;
  }

  const backToList = (): void => {
    if (router.route.value.name !== 'annonces') {
      router.navigate(LIST_HASH);
    }
  };

  const remove = async (removed: VehicleDto): Promise<void> => {
    if (!window.confirm(REMOVAL_QUESTION)) {
      return;
    }
    if (await changes.remove(removed)) {
      toast.show('Annonce supprimée');
      router.navigate(LIST_HASH);
    }
  };

  return (
    <>
      <a class="btn quiet back" href={LIST_HASH}>
        ← Annonces
      </a>
      <VehicleSheet key={vehicle.id} vehicle={vehicle} onActed={backToList} onUndone={backToList} />
      <div class="row" style={{ justifyContent: 'flex-end' }}>
        <button class="btn quiet small danger" type="button" onClick={() => void remove(vehicle)}>
          Supprimer cette annonce
        </button>
      </div>
    </>
  );
};
