import type { Family, FamilyRulesDto, SettingsDto } from '../../../../src/shared/api';

const withoutFirst = (items: readonly string[], item: string): readonly string[] => {
  const index = items.indexOf(item);
  return items.filter((_, position) => position !== index);
};

const withItem = (items: readonly string[], item: string): readonly string[] => (items.includes(item) ? items : [...items, item]);

export const shownBrands = (rules: FamilyRulesDto): readonly string[] => [...new Set([...rules.known, ...rules.brands])];

export const withFamilyRules = (settings: SettingsDto, family: Family, change: (rules: FamilyRulesDto) => FamilyRulesDto): SettingsDto => ({
  ...settings,
  families: { ...settings.families, [family]: change(settings.families[family]) },
});

export const withBrandToggled = (rules: FamilyRulesDto, brand: string): FamilyRulesDto => ({
  ...rules,
  brands: rules.brands.includes(brand) ? withoutFirst(rules.brands, brand) : [...rules.brands, brand],
});

export const withBrandAdded = (rules: FamilyRulesDto, brand: string): FamilyRulesDto => ({
  ...rules,
  known: withItem(rules.known, brand),
  brands: withItem(rules.brands, brand),
});

export const withKeywordAdded = (rules: FamilyRulesDto, keyword: string): FamilyRulesDto => ({
  ...rules,
  keywords: withItem(rules.keywords, keyword),
});

export const withoutKeyword = (rules: FamilyRulesDto, keyword: string): FamilyRulesDto => ({
  ...rules,
  keywords: withoutFirst(rules.keywords, keyword),
});
