import type { JSX, TargetedEvent, TargetedFocusEvent } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { VehicleDto } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { autosize } from './autosize';
import { Icon } from './Icon';

const PLACEHOLDER = 'Note pour vous : ce que le vendeur a dit, un prix, quand rappeler…';

const SAVED_TEXT = 'Note enregistrée';

const CLEARED_TEXT = 'Note effacée';

export const NoteField = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element => {
  const { changes, toast } = useAppState();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState(vehicle.note || '');

  useLayoutEffect(() => setNote(vehicle.note || ''), [vehicle.note]);

  useLayoutEffect(() => {
    if (textarea.current !== null) {
      autosize(textarea.current);
    }
  }, [note]);

  const save = async (event: TargetedFocusEvent<HTMLTextAreaElement>): Promise<void> => {
    const written = event.currentTarget.value;
    if (written === (vehicle.note || '')) {
      return;
    }
    const saved = await changes.save(vehicle, { note: written });
    if (saved !== null) {
      toast.show(saved.note ? SAVED_TEXT : CLEARED_TEXT);
    }
  };

  return (
    <div class="vnote-field">
      <label for={`note-${vehicle.id}`}>
        <Icon name="pen" />
        Votre note
      </label>
      <textarea
        ref={textarea}
        id={`note-${vehicle.id}`}
        class="input"
        rows={2}
        placeholder={PLACEHOLDER}
        aria-label="Note"
        value={note}
        onInput={(event: TargetedEvent<HTMLTextAreaElement>) => setNote(event.currentTarget.value)}
        onBlur={(event) => void save(event)}
      />
    </div>
  );
};
