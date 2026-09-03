import ct from 'countries-and-timezones';

/**
 * Is this IANA timezone plausible for the given ISO 3166-1 alpha-2 country?
 * Backed by the IANA tzdata country/zone associations (via
 * `countries-and-timezones`), not a hand-guessed table.
 */
export function isTimezonePlausibleForCountry(timezone: string, countryCode: string): boolean {
  // `getCountry(...).timezones` only lists canonical IANA zone names and
  // drops legacy aliases (e.g. Benin's canonical zone is "Africa/Lagos" -
  // "Africa/Porto-Novo" is a deprecated alias of it, but real devices and
  // browsers still report it). `getTimezone` resolves aliases first, so it
  // correctly recognizes both forms.
  const tz = ct.getTimezone(timezone);
  if (!tz) return false;
  return (tz.countries as string[]).includes(countryCode.toUpperCase());
}

/**
 * Weak signal only (spec ยง11: users can legitimately change locale). We just
 * check whether the language subtag's implied region (e.g. "fr-BJ" -> BJ)
 * matches, when a region subtag is present at all.
 */
export function isLanguagePlausibleForCountry(language: string, countryCode: string): boolean {
  const parts = language.split('-');
  if (parts.length < 2) return true; // no region subtag -> can't contradict
  const region = parts[parts.length - 1]!.toUpperCase();
  return region === countryCode.toUpperCase();
}
