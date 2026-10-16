import type { JSX } from 'preact';
import type { SourceRunDto } from '../../../../src/shared/api';

export const RunStatus = ({ run }: { readonly run: SourceRunDto | null | undefined }): JSX.Element =>
  run ? (
    <span class={`badge ${run.ok ? 'ok' : 'warn'}`}>{run.ok ? 'Fonctionne' : 'Problème'}</span>
  ) : (
    <span class="badge">Jamais vérifiée</span>
  );
