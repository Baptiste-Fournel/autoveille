export const invalidNumberVariableText = (variable: string, value: string): string =>
  `${variable} doit être un nombre (valeur lue : « ${value} »).`;

export const invalidSwitchVariableText = (variable: string, value: string): string =>
  `${variable} doit valoir 0 ou 1 (valeur lue : « ${value} »).`;
