const BORDER_ALLOWANCE_PX = 2;

export const autosize = (textarea: HTMLTextAreaElement): void => {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + BORDER_ALLOWANCE_PX}px`;
};
