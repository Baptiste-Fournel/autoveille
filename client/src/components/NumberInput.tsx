import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';

export interface NumberInputProps {
  readonly id: string;
  readonly value: number;
  readonly onValue: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export const NumberInput = ({ id, value, onValue, min, max, step }: NumberInputProps): JSX.Element => {
  const typed = useRef<string | null>(null);
  if (typed.current !== null && Number(typed.current) !== value) {
    typed.current = null;
  }
  return (
    <input
      class="input"
      id={id}
      type="number"
      inputmode="numeric"
      min={min}
      max={max}
      step={step}
      value={typed.current ?? String(value)}
      onInput={(event) => {
        typed.current = event.currentTarget.value;
        onValue(Number(event.currentTarget.value));
      }}
    />
  );
};
