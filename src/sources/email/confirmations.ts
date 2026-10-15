import * as cheerio from 'cheerio';
import { cleanText } from '../../domain/parsing/text.js';
import { alertAdviceSentence, alertMismatchSentence } from '../../domain/presentation/alerts.js';
import { siteForSender } from '../../domain/sites/catalog.js';
import {
  alertAdvice as alertWidening,
  alertMismatch as alertMismatches,
  detectAlertConfirmation as detectInExtractedEmail,
  type EmailLink,
} from '../../domain/sites/confirmations.js';
import type { AlertInfo, Settings } from '../../types.js';

export { siteLabel } from '../../domain/sites/catalog.js';

interface Input {
  from: string;
  subject: string;
  html?: string;
  text?: string;
  date?: Date;
}

export function visibleText(input: Pick<Input, 'html' | 'text'>): { text: string; links: EmailLink[] } {
  if (input.html) {
    const $ = cheerio.load(input.html);
    $('script, style, head').remove();
    const parts: string[] = [];
    $('body *').each((_i, el) => {
      el.children?.forEach((c) => {
        if (c.type === 'text') parts.push((c as unknown as { data: string }).data);
      });
    });
    const text = cleanText(parts.join(' ').replace(/[\u200B-\u200F\u00AD]|\u034F/g, ''));
    const links = $('a[href]')
      .map((_i, a) => ({ text: cleanText($(a).text()), href: ($(a).attr('href') ?? '').trim() }))
      .get();
    return { text, links };
  }
  return { text: cleanText(input.text ?? ''), links: [] };
}

export function detectAlertConfirmation(input: Input): AlertInfo | undefined {
  if (!siteForSender(input.from)) return undefined;
  const { text, links } = visibleText(input);
  return detectInExtractedEmail({ from: input.from, subject: input.subject, text, links, date: input.date ?? new Date() });
}

export function alertMismatch(a: AlertInfo, settings: Settings): string[] {
  return alertMismatches(a, settings).map(alertMismatchSentence);
}

export function alertAdvice(a: AlertInfo, settings: Settings): string | undefined {
  const widening = alertWidening(a, settings);
  return widening ? alertAdviceSentence(widening) : undefined;
}
