import { useEffect } from 'preact/hooks';
import type { SettingsDto, SettingsResponse } from '../../../src/shared/api';
import { errorText } from '../api/errorText';
import type { AppState } from '../state/appState';
import { useAppState } from './AppContext';
import { useRefresh } from './useRefresh';

export interface LoadedSettingsDraft {
  readonly saved: SettingsResponse;
  readonly draft: SettingsDto;
}

const reloadUnlessDirty = ({ settings, toast }: Pick<AppState, 'settings' | 'toast'>): void => {
  void settings.loadUnlessDirty().catch((error: unknown) => toast.show(errorText(error), { error: true }));
};

export const useSettingsDraft = (): LoadedSettingsDraft | null => {
  const state = useAppState();
  useEffect(() => reloadUnlessDirty(state), [state]);
  useRefresh(() => reloadUnlessDirty(state));
  const saved = state.settings.saved.value;
  const draft = state.settings.draft.value;
  return saved === null || draft === null ? null : { saved, draft };
};
