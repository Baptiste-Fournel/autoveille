import type { JSX } from 'preact';
import type { SettingsPreviewDto } from '../../../../src/shared/api';
import { plural } from '../../format/plural';

export const PreviewCount = ({ preview }: { readonly preview: SettingsPreviewDto | null }): JSX.Element => (
  <div class="count" id="preview-count">
    {preview === null ? (
      <span>Calcul en cours…</span>
    ) : (
      <>
        <b>{`${plural(preview.pass, 'annonce', 'annonces')} sur 7 jours`}</b>
        <span>{`avec ces réglages, sur ${plural(preview.total, 'annonce reçue', 'annonces reçues')}`}</span>
      </>
    )}
  </div>
);
