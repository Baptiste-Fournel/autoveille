import type { JSX } from 'preact';
import { AddChip } from './AddChip';

export interface ChipListProps {
  readonly id?: string;
  readonly items: readonly string[];
  readonly addLabel: string;
  readonly onAdd: (item: string) => void;
  readonly pressed?: (item: string) => boolean;
  readonly onToggle?: (item: string) => void;
  readonly onRemove?: (item: string) => void;
}

const REMOVE_MARK_CLASS = 'x';

const isOnRemoveMark = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(`.${REMOVE_MARK_CLASS}`) !== null;

export const ChipList = ({ id, items, addLabel, onAdd, pressed, onToggle, onRemove }: ChipListProps): JSX.Element => (
  <div class="chips" id={id}>
    {items.map((item) => (
      <button
        key={item}
        class="chip"
        type="button"
        aria-pressed={pressed?.(item)}
        onClick={(event) => {
          if (onRemove !== undefined && isOnRemoveMark(event.target)) {
            onRemove(item);
          } else {
            onToggle?.(item);
          }
        }}
      >
        {item}
        {onRemove === undefined ? null : (
          <span class={REMOVE_MARK_CLASS} title="Retirer">
            ×
          </span>
        )}
      </button>
    ))}
    <AddChip label={addLabel} onAdd={onAdd} />
  </div>
);
