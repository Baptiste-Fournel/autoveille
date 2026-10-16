import type { Family, SettingsDto } from '../../../../src/shared/api';

const NEW_VARIANT_WITHOUT_MODEL = 'Bonjour,\n\n';

const withVariants = (settings: SettingsDto, family: Family, change: (variants: readonly string[]) => readonly string[]): SettingsDto => ({
  ...settings,
  templates: { ...settings.templates, [family]: { ...settings.templates[family], variants: change(settings.templates[family].variants) } },
});

export const withVariantText = (settings: SettingsDto, family: Family, index: number, text: string): SettingsDto =>
  withVariants(settings, family, (variants) => variants.map((variant, position) => (position === index ? text : variant)));

export const withVariantAdded = (settings: SettingsDto, family: Family): SettingsDto =>
  withVariants(settings, family, (variants) => [...variants, variants[0] || NEW_VARIANT_WITHOUT_MODEL]);

export const withoutVariant = (settings: SettingsDto, family: Family, index: number): SettingsDto =>
  withVariants(settings, family, (variants) => variants.filter((_, position) => position !== index));
