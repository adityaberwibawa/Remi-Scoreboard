/** Formatter alamat murni; tidak mengimpor modul native agar mudah diuji. */
import type { GeocodedPlace } from './types';

export interface AddressParts {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function streetLine(street: string | null, number: string | null): string | null {
  if (street && number) return `${street} No. ${number}`;
  return street ?? number;
}

/** Bangun alamat yang enak dibaca dari komponen reverse geocoding. */
export function formatAddress(parts: AddressParts): GeocodedPlace | null {
  const name = clean(parts.name);
  const street = streetLine(clean(parts.street), clean(parts.streetNumber));
  const district = clean(parts.district);
  const city = clean(parts.city);
  const region = clean(parts.region);
  const country = clean(parts.country);
  const formatted = clean(parts.formattedAddress);

  const components = [name, street, district, city, region, country].filter(
    (part): part is string => part !== null,
  );

  // Buang komponen yang sama (mis. city dan region sama-sama "Bandung").
  const seen = new Set<string>();
  const unique = components.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const address = formatted ?? unique.join(', ');
  if (!address) return null;

  return {
    address,
    placeName: name ?? street ?? city ?? null,
  };
}
