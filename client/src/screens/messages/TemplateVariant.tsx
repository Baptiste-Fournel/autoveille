import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Family, TemplatePreviewResponse } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';
import { withoutVariant, withVariantText } from './templateVariantsEdits';

const PREVIEW_DELAY_MS = 300;

const PREVIEW_PENDING = '…';

const keepWriting = (): void => undefined;

export interface TemplateVariantProps {
  readonly family: Family;
  readonly index: number;
  readonly text: string;
  readonly removable: boolean;
  readonly variables: Readonly<Record<string, string>>;
}

export const TemplateVariant = ({ family, index, text, removable, variables }: TemplateVariantProps): JSX.Element => {
  const { api, settings } = useAppState();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<TemplatePreviewResponse | null>(null);

  useLayoutEffect(() => {
    textarea.current?.setSelectionRange(0, 0);
  }, []);

  useEffect(() => {
    let wanted = true;
    const timer = setTimeout(() => {
      api.previewTemplate({ family, text }).then((answer) => {
        if (wanted) {
          setPreview(answer);
        }
      }, keepWriting);
    }, PREVIEW_DELAY_MS);
    return () => {
      wanted = false;
      clearTimeout(timer);
    };
  }, [api, family, text]);

  const insertVariable = (name: string): void => {
    const field = textarea.current;
    if (field === null) {
      return;
    }
    field.setRangeText(`{${name}}`, field.selectionStart, field.selectionEnd, 'end');
    field.dispatchEvent(new Event('input'));
    field.focus();
  };

  return (
    <div class="variant">
      <div class="vhead">
        <h3>{`Variante ${index + 1}`}</h3>
        {removable ? (
          <button
            class="btn quiet small danger"
            type="button"
            onClick={() => settings.edit((draft) => withoutVariant(draft, family, index))}
          >
            Supprimer
          </button>
        ) : null}
      </div>
      <textarea
        class="input"
        rows={10}
        spellcheck={true}
        ref={textarea}
        value={text}
        onInput={(event) => {
          const written = event.currentTarget.value;
          settings.edit((draft) => withVariantText(draft, family, index, written));
        }}
      />
      <div class="vars">
        {Object.entries(variables).map(([name, help]) => (
          <button key={name} class="chip" type="button" title={help} onClick={() => insertVariable(name)}>
            {`{${name}}`}
          </button>
        ))}
      </div>
      <div class="stack">
        {preview?.warnings.map((warning) => (
          <div key={warning} class="note warn">
            {warning}
          </div>
        ))}
      </div>
      <Field label="Aperçu sur une annonce">
        {(id) => (
          <div class="preview" id={id}>
            {preview?.text ?? PREVIEW_PENDING}
          </div>
        )}
      </Field>
    </div>
  );
};
