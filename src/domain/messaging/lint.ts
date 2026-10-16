export type TemplateWarning = 'longDash' | 'emoji' | 'bulletList' | 'stockPhrase' | 'noWayToBeReached' | 'noOptOutSentence';

const LONG_DASH = /[—–]/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const BULLET_LINE = /^\s*[-*•]\s/m;
const STOCK_PHRASE = /n'hésitez pas|je me permets|dans le cadre de|je reste à votre (entière )?disposition/i;
const PHONE_VARIABLE = /\{telephone\}/;
const PHONE_NUMBER = /\d{2}[ .]?\d{2}[ .]?\d{2}[ .]?\d{2}[ .]?\d{2}/;
const OPT_OUT_SENTENCE =
  /n['’]insisterai pas|ne (vous )?relancerai pas|ne (vous )?recontacterai pas|ne reviendrai pas vers vous|pas de relance|sans suite de ma part|ne vous solliciterai plus|sans insister/i;

interface TemplateCheck {
  readonly warning: TemplateWarning;
  readonly fails: (text: string) => boolean;
}

const CHECKS: readonly TemplateCheck[] = [
  { warning: 'longDash', fails: (text) => LONG_DASH.test(text) },
  { warning: 'emoji', fails: (text) => EMOJI.test(text) },
  { warning: 'bulletList', fails: (text) => BULLET_LINE.test(text) },
  { warning: 'stockPhrase', fails: (text) => STOCK_PHRASE.test(text) },
  { warning: 'noWayToBeReached', fails: (text) => !PHONE_VARIABLE.test(text) && !PHONE_NUMBER.test(text) },
  { warning: 'noOptOutSentence', fails: (text) => !OPT_OUT_SENTENCE.test(text) },
];

export function lintTemplate(text: string): readonly TemplateWarning[] {
  return CHECKS.filter((check) => check.fails(text)).map((check) => check.warning);
}
