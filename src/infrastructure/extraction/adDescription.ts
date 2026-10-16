const MAX_DESCRIPTION_LENGTH = 600;

export const adDescription = (text: string): string => text.slice(0, MAX_DESCRIPTION_LENGTH);
