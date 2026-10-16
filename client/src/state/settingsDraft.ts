import { computed, type ReadonlySignal, signal } from '@preact/signals';
import type { SettingsDto, SettingsResponse, SettingsUpdateResponse } from '../../../src/shared/api';
import type { ApiClient } from '../api/client';

export interface SettingsDraft {
  readonly saved: ReadonlySignal<SettingsResponse | null>;
  readonly draft: ReadonlySignal<SettingsDto | null>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly loadUnlessDirty: () => Promise<void>;
  readonly edit: (change: (draft: SettingsDto) => SettingsDto) => void;
  readonly save: (settings: SettingsDto) => Promise<SettingsUpdateResponse>;
}

export const createSettingsDraft = (api: ApiClient): SettingsDraft => {
  const saved = signal<SettingsResponse | null>(null);
  const draft = signal<SettingsDto | null>(null);
  const dirty = computed(
    () => saved.value !== null && draft.value !== null && JSON.stringify(draft.value) !== JSON.stringify(saved.value.settings),
  );
  return {
    saved,
    draft,
    dirty,
    loadUnlessDirty: async () => {
      if (saved.value !== null && dirty.value) {
        return;
      }
      const shown = draft.value;
      const loaded = await api.settings();
      if (draft.value !== shown) {
        return;
      }
      saved.value = loaded;
      draft.value = loaded.settings;
    },
    edit: (change) => {
      if (draft.value !== null) {
        draft.value = change(draft.value);
      }
    },
    save: async (settings) => {
      const answer = await api.saveSettings(settings);
      const meta = saved.value;
      saved.value = meta === null ? meta : { ...meta, settings: answer.settings };
      draft.value = answer.settings;
      return answer;
    },
  };
};
