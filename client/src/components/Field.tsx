import type { ComponentChildren, JSX } from 'preact';
import { useId } from 'preact/hooks';

export interface FieldProps {
  readonly label: string;
  readonly help?: string;
  readonly children: (id: string) => ComponentChildren;
}

export const Field = ({ label, help, children }: FieldProps): JSX.Element => {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>{label}</label>
      {children(id)}
      {help === undefined ? null : <span class="help">{help}</span>}
    </div>
  );
};
