import type { JSX, RefObject, TargetedEvent, TargetedFocusEvent } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import type { VehicleDto } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { autosize } from './autosize';

const SAVED_TEXT = 'Message enregistré';

const UNFOLD_TEXT = 'Lire la suite ou modifier';

const FOLD_TEXT = 'Réduire';

const FOLDED_HINT = 'Retouchez le texte si besoin, il est copié tel quel.';

const OPEN_HINT = 'Le message proposé, modifiable. Il est copié tel quel.';

export interface MessageFieldProps {
  readonly vehicle: VehicleDto;
  readonly folded: boolean;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly onSaved?: (saved: VehicleDto) => void;
}

export const MessageField = ({ vehicle, folded, textareaRef, onSaved }: MessageFieldProps): JSX.Element => {
  const { changes, toast } = useAppState();
  const [text, setText] = useState(vehicle.message);
  const [unfolded, setUnfolded] = useState(false);

  useLayoutEffect(() => setText(vehicle.message), [vehicle.message]);

  useLayoutEffect(() => {
    textareaRef.current?.setSelectionRange(0, 0);
  }, [textareaRef]);

  useLayoutEffect(() => {
    if (textareaRef.current !== null) {
      autosize(textareaRef.current);
    }
  }, [text, unfolded, textareaRef]);

  const save = async (event: TargetedFocusEvent<HTMLTextAreaElement>): Promise<void> => {
    const message = event.currentTarget.value;
    if (message === vehicle.message) {
      return;
    }
    const saved = await changes.save(vehicle, { message });
    if (saved !== null) {
      toast.show(SAVED_TEXT);
      onSaved?.(saved);
    }
  };

  const textarea = (
    <textarea
      ref={textareaRef}
      rows={4}
      aria-label="Message à envoyer"
      spellcheck
      value={text}
      onInput={(event: TargetedEvent<HTMLTextAreaElement>) => setText(event.currentTarget.value)}
      onFocus={() => setUnfolded(true)}
      onBlur={(event) => void save(event)}
    />
  );

  if (!folded) {
    return (
      <div class="message open">
        <div class="ta-wrap">{textarea}</div>
        <span class="hint">{OPEN_HINT}</span>
      </div>
    );
  }
  return (
    <div class={unfolded ? 'message' : 'message collapsed'}>
      <div class="ta-wrap">
        {textarea}
        <div class="fade" />
      </div>
      <div class="row between">
        <button class="btn quiet small" type="button" onClick={() => setUnfolded(!unfolded)}>
          {unfolded ? FOLD_TEXT : UNFOLD_TEXT}
        </button>
        <span class="hint">{FOLDED_HINT}</span>
      </div>
    </div>
  );
};
