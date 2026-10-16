import { useEffect, useState } from 'preact/hooks';
import type { SettingsDto, SettingsPreviewDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';

const PREVIEW_DELAY_MS = 350;

const keepLastCount = (): void => undefined;

export interface SettingsPreview {
  readonly preview: SettingsPreviewDto | null;
  readonly show: (preview: SettingsPreviewDto) => void;
}

export const useSettingsPreview = (draft: SettingsDto | null): SettingsPreview => {
  const { api } = useAppState();
  const [preview, show] = useState<SettingsPreviewDto | null>(null);
  useEffect(() => {
    if (draft === null) {
      return undefined;
    }
    let wanted = true;
    const timer = setTimeout(() => {
      api.previewSettings(draft).then(({ pass, total }) => {
        if (wanted) {
          show({ pass, total });
        }
      }, keepLastCount);
    }, PREVIEW_DELAY_MS);
    return () => {
      wanted = false;
      clearTimeout(timer);
    };
  }, [api, draft]);
  return { preview, show };
};
