import type { JSX } from 'preact';
import type { DealerDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { Field } from '../../components/Field';

export const DealerSection = ({ dealer }: { readonly dealer: DealerDto }): JSX.Element => {
  const { settings } = useAppState();
  const write = (key: keyof DealerDto, value: string): void =>
    settings.edit((draft) => ({ ...draft, dealer: { ...draft.dealer, [key]: value } }));
  return (
    <section class="card section">
      <h2>Vous</h2>
      <p class="muted small">Ces informations remplissent automatiquement les messages.</p>
      <div class="grid2">
        <Field label="Prénom">
          {(id) => (
            <input
              class="input"
              id={id}
              value={dealer.firstName}
              autocomplete="given-name"
              placeholder="Votre prénom"
              onInput={(event) => write('firstName', event.currentTarget.value)}
            />
          )}
        </Field>
        <Field label="Nom">
          {(id) => (
            <input
              class="input"
              id={id}
              value={dealer.lastName}
              autocomplete="family-name"
              placeholder="Votre nom"
              onInput={(event) => write('lastName', event.currentTarget.value)}
            />
          )}
        </Field>
      </div>
      <div class="grid2">
        <Field label="Concession">
          {(id) => (
            <input
              class="input"
              id={id}
              value={dealer.company}
              placeholder="Nom de la concession"
              onInput={(event) => write('company', event.currentTarget.value)}
            />
          )}
        </Field>
        <Field label="Ville de la concession">
          {(id) => (
            <input
              class="input"
              id={id}
              value={dealer.city}
              placeholder="Bordeaux"
              onInput={(event) => write('city', event.currentTarget.value)}
            />
          )}
        </Field>
      </div>
      <Field label="Téléphone" help="Il figure dans chaque message : c’est ce qui permet au vendeur de vous joindre.">
        {(id) => (
          <input
            class="input"
            id={id}
            value={dealer.phone}
            type="tel"
            inputmode="tel"
            placeholder="06 12 34 56 78"
            onInput={(event) => write('phone', event.currentTarget.value)}
          />
        )}
      </Field>
    </section>
  );
};
