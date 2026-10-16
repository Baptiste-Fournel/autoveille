export type Family = 'allemandes' | 'italiennes' | 'americaines' | 'francaises' | 'autres';

export const FOLLOWED_FAMILIES: readonly Family[] = ['allemandes', 'italiennes', 'americaines', 'francaises'];

export const ALL_FAMILIES: readonly Family[] = [...FOLLOWED_FAMILIES, 'autres'];
