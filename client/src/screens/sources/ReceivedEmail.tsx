import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ProcessedEmailDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { ago } from '../../format/ago';
import { emailListingLine } from './listingLine';

const CLICKABLE = { cursor: 'pointer' } as const;

const LIST_STYLE = { margin: '0', paddingLeft: '18px' } as const;

const TRUNCATED_EMAIL_TITLE = 'Le site annonce plus d’annonces que son email n’en montre : les autres ne sont visibles que sur le site.';

const LEFT_ASIDE_TITLE =
  'Email de baisse de prix ou de relance : les voitures déjà connues ont été mises à jour, les autres ne sont pas des nouveautés et ne sont pas créées.';

const leftAsideText = (count: number): string => `${count} ${count > 1 ? 'anciennes laissées' : 'ancienne laissée'} de côté`;

const ListingCount = ({ email }: { readonly email: ProcessedEmailDto }): JSX.Element => {
  if (email.error) {
    return <span class="badge warn">Erreur</span>;
  }
  const announced = email.parsed?.announced;
  const leftAside = email.parsed?.leftAside ?? 0;
  return (
    <>
      {String(email.parsed_count)}
      <span class="unit">{email.parsed_count > 1 ? ' annonces' : ' annonce'}</span>
      {announced !== undefined && announced > email.parsed_count ? (
        <span class="badge warn" title={TRUNCATED_EMAIL_TITLE}>{`${announced} annoncées`}</span>
      ) : null}
      {leftAside > 0 ? (
        <span class="badge" title={LEFT_ASIDE_TITLE}>
          {leftAsideText(leftAside)}
        </span>
      ) : null}
    </>
  );
};

const EmailDetail = ({ email }: { readonly email: ProcessedEmailDto }): JSX.Element => {
  if (email.error) {
    return <div class="note warn">{email.error}</div>;
  }
  const parsed = email.parsed;
  if (parsed?.listings.length) {
    return (
      <ul style={LIST_STYLE}>
        {parsed.listings.map((listing) => (
          <li key={listing.url}>{emailListingLine(listing)}</li>
        ))}
      </ul>
    );
  }
  return (
    <span class="muted small">{`Aucune annonce reconnue dans cet email${parsed?.pending ? ` (${parsed.pending} lien(s) non résolus)` : ''}.`}</span>
  );
};

export const ReceivedEmail = ({ email }: { readonly email: ProcessedEmailDto }): JSX.Element => {
  const { refresh } = useAppState();
  const [open, setOpen] = useState(false);
  const toggle = (): void => setOpen(!open);
  return (
    <>
      <tr style={CLICKABLE} onClick={toggle}>
        <td>{ago(email.received_at || email.processed_at, refresh.now.value)}</td>
        <td>{email.site || email.sender}</td>
        <td class="ellip" title={email.subject}>
          {email.subject}
        </td>
        <td class="n">
          <ListingCount email={email} />
        </td>
      </tr>
      <tr class={open ? undefined : 'hidden'}>
        <td colspan={4}>
          <EmailDetail email={email} />
        </td>
      </tr>
    </>
  );
};
