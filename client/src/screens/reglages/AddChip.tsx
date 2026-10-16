import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface AddChipProps {
  readonly label: string;
  readonly onAdd: (item: string) => void;
}

const ADD_INPUT_STYLE = { maxWidth: '220px' } as const;

const ItemInput = ({ label, onAdd, onClose }: AddChipProps & { readonly onClose: () => void }): JSX.Element => {
  const input = useRef<HTMLInputElement>(null);
  const closed = useRef(false);
  useEffect(() => input.current?.focus(), []);
  const close = (typed: string): void => {
    if (closed.current) {
      return;
    }
    closed.current = true;
    const item = typed.trim();
    if (item !== '') {
      onAdd(item);
    }
    onClose();
  };
  return (
    <input
      class="input"
      placeholder={label}
      style={ADD_INPUT_STYLE}
      ref={input}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          close(event.currentTarget.value);
        }
        if (event.key === 'Escape') {
          close('');
        }
      }}
      onBlur={(event) => close(event.currentTarget.value)}
    />
  );
};

export const AddChip = ({ label, onAdd }: AddChipProps): JSX.Element => {
  const [adding, setAdding] = useState(false);
  if (adding) {
    return <ItemInput label={label} onAdd={onAdd} onClose={() => setAdding(false)} />;
  }
  return (
    <button class="chip add" type="button" onClick={() => setAdding(true)}>
      {`+ ${label}`}
    </button>
  );
};
