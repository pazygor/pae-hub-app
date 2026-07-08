// Geocodificação — Fase de refinamento (endereço → lat/lng).
// CEP-autofill é client-side (BrasilAPI, com CORS); o cálculo de lat/lng passa
// pelo back (política do Nominatim: User-Agent/timeout).
import { http } from './client';

export interface GeocodeInput {
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CepLookup {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export const geocodingApi = {
  /** Localizar: resolve lat/lng do endereço via back (cascata BrasilAPI/Awesome/Nominatim). */
  coordinates: (input: GeocodeInput): Promise<Coordinates | null> =>
    http.post<Coordinates | null>('/geocoding/coordinates', input),
};

/** Consulta CEP no BrasilAPI (client-side, CORS liberado) para preencher o endereço. */
export async function lookupCep(cep: string): Promise<CepLookup | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      street: d.street || undefined,
      neighborhood: d.neighborhood || undefined,
      city: d.city || undefined,
      state: d.state || undefined,
    };
  } catch {
    return null;
  }
}
