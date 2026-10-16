import type { Toast } from '../state/toast';

const BLOCKED_TEXT = 'Le navigateur a bloqué l’ouverture de l’annonce : ouvrez-la avec le lien « Voir l’annonce ».';

const COPIED_TEXT = 'Message copié : collez-le dans le formulaire de contact de l’annonce.';

const NOT_COPIED_TEXT = 'Annonce ouverte. Copiez le message à la main.';

const copiedThroughHiddenField = (text: string): boolean => {
  try {
    const field = document.createElement('textarea');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.value = text;
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
};

const copyStartedInTheTap = (text: string): Promise<boolean> =>
  typeof navigator.clipboard?.writeText === 'function'
    ? navigator.clipboard.writeText(text).then(
        () => true,
        () => copiedThroughHiddenField(text),
      )
    : Promise.resolve(copiedThroughHiddenField(text));

const detachedFromApplication = (opened: Window): void => {
  try {
    opened.opener = null;
  } catch {
    return;
  }
};

export const openListingAndCopyMessage = async (url: string, message: string, toast: Pick<Toast, 'show'>): Promise<boolean> => {
  const copying = copyStartedInTheTap(message);
  const opened = window.open(url, '_blank');
  if (opened !== null) {
    detachedFromApplication(opened);
  }
  const copied = await copying;
  if (opened === null) {
    toast.show(BLOCKED_TEXT, { error: true });
  } else {
    toast.show(copied ? COPIED_TEXT : NOT_COPIED_TEXT);
  }
  return opened !== null;
};
