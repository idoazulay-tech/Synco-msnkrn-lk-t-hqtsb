/**
 * Synco Localization Helper
 *
 * Hebrew is the default and primary language.
 * English skeleton is included for future multilingual support.
 * Adding a new language: create <lang>.ts and add to LOCALES map.
 */

import { heMessages, type HeMessages } from './he.js';
import { enMessages } from './en.js';

export type Locale = 'he' | 'en';

export const DEFAULT_LOCALE: Locale = 'he';

// Both locales must satisfy the HeMessages shape (Hebrew is the reference)
const LOCALES: Record<Locale, HeMessages> = {
  he: heMessages,
  en: enMessages as unknown as HeMessages,
};

/** Return the messages for a given locale, falling back to Hebrew */
export function getMessages(locale: Locale = DEFAULT_LOCALE): HeMessages {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

/** Default Hebrew messages — use directly for single-locale code */
export const t = getMessages(DEFAULT_LOCALE);

export type { HeMessages };
