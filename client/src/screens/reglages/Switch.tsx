import type { JSX } from 'preact';
import { useId } from 'preact/hooks';

export interface SwitchProps {
  readonly title: string;
  readonly help: string;
  readonly on: boolean;
  readonly onToggle: () => void;
}

export const Switch = ({ title, help, on, onToggle }: SwitchProps): JSX.Element => {
  const id = useId();
  return (
    <label class="switch" for={id}>
      <span class="text">
        <b>{title}</b>
        <span>{help}</span>
      </span>
      <button class="toggle" id={id} role="switch" type="button" aria-checked={on} onClick={onToggle} />
    </label>
  );
};
