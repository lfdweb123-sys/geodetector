import ct from 'countries-and-timezones';

export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRIES: CountryOption[] = Object.values(ct.getAllCountries())
  .map((c) => ({ code: c.id, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));
