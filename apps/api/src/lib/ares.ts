/**
 * ARES + VIES lookups (per `21-b2b-complete.md` — CZ/SK/EU B2B).
 *
 * ARES = the Czech business register. Entering an IČO auto-fills the company
 * name, DIČ and registered address — a standard CZ checkout/B2B convenience
 * (Shoptet/Upgates both have it). Public REST API, no credentials.
 *
 * VIES = the EU VAT validation service. Confirms a DIČ/VAT ID is valid in its
 * member state — prerequisite for EU B2B reverse-charge. Public REST API.
 *
 * Both fetches fail soft: a network/parse error returns `found:false` rather
 * than blocking the form. The pure parsers are unit-tested with fixtures.
 */

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';
const VIES_BASE = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms';

export interface AresCompany {
  found: boolean;
  ico?: string;
  name?: string;
  vatId?: string | null;
  address?: {
    line1: string;
    city: string;
    postalCode: string;
    countryCode: string;
  };
}

/** ARES `sidlo` (registered seat) shape — only the fields we use. */
interface AresSidlo {
  nazevObce?: string;
  nazevUlice?: string;
  cisloDomovni?: number;
  cisloOrientacni?: number;
  cisloOrientacniPismeno?: string;
  psc?: number | string;
  textovaAdresa?: string;
}
interface AresResponse {
  ico?: string;
  obchodniJmeno?: string;
  dic?: string;
  sidlo?: AresSidlo;
}

/** Build a street "line1" from ARES seat fields (or fall back to textovaAdresa). */
function aresStreet(s: AresSidlo): string {
  if (s.nazevUlice) {
    let num = s.cisloDomovni ? String(s.cisloDomovni) : '';
    if (s.cisloOrientacni) num += `/${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ''}`;
    return num ? `${s.nazevUlice} ${num}` : s.nazevUlice;
  }
  // Some entities have no street (small municipalities) — use the seat town or
  // the first segment of the textual address.
  if (s.textovaAdresa) return s.textovaAdresa.split(',')[0]!.trim();
  return s.nazevObce ?? '';
}

/** Parse a raw ARES JSON response into our shape. Exposed for unit tests. */
export function parseAres(raw: unknown): AresCompany {
  const r = raw as AresResponse;
  if (!r || !r.ico || !r.obchodniJmeno) return { found: false };
  const s = r.sidlo ?? {};
  const psc = s.psc != null ? String(s.psc).replace(/\s/g, '') : '';
  return {
    found: true,
    ico: r.ico,
    name: r.obchodniJmeno,
    vatId: r.dic ? (r.dic.startsWith('CZ') ? r.dic : `CZ${r.dic}`) : null,
    address: {
      line1: aresStreet(s),
      city: s.nazevObce ?? '',
      postalCode: psc.length === 5 ? `${psc.slice(0, 3)} ${psc.slice(3)}` : psc,
      countryCode: 'CZ',
    },
  };
}

/** Look up a company by IČO in ARES. Fails soft to `found:false`. */
export async function lookupAres(ico: string): Promise<AresCompany> {
  const clean = ico.replace(/\s/g, '');
  if (!/^\d{8}$/.test(clean)) return { found: false };
  try {
    const res = await fetch(`${ARES_BASE}/${clean}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { found: false };
    return parseAres(await res.json());
  } catch {
    return { found: false };
  }
}

export interface ViesResult {
  valid: boolean;
  name?: string | null;
  address?: string | null;
  countryCode?: string;
  vatNumber?: string;
}

interface ViesResponse {
  isValid?: boolean;
  valid?: boolean; // some responses use `valid`
  name?: string;
  address?: string;
  countryCode?: string;
  vatNumber?: string;
}

/** Split a full VAT id like "CZ12345678" → { country: 'CZ', number: '12345678' }. */
export function splitVatId(vatId: string): { country: string; number: string } | null {
  const clean = vatId.replace(/\s/g, '').toUpperCase();
  const m = /^([A-Z]{2})(.+)$/.exec(clean);
  if (!m) return null;
  return { country: m[1]!, number: m[2]! };
}

/** Parse a raw VIES response. Exposed for unit tests. */
export function parseVies(raw: unknown): ViesResult {
  const r = raw as ViesResponse;
  const valid = Boolean(r?.isValid ?? r?.valid);
  return {
    valid,
    name: r?.name ?? null,
    address: r?.address ?? null,
    ...(r?.countryCode ? { countryCode: r.countryCode } : {}),
    ...(r?.vatNumber ? { vatNumber: r.vatNumber } : {}),
  };
}

/** Validate an EU VAT id via VIES. Fails soft to `valid:false`. */
export async function validateVies(vatId: string): Promise<ViesResult> {
  const parts = splitVatId(vatId);
  if (!parts) return { valid: false };
  try {
    const res = await fetch(`${VIES_BASE}/${parts.country}/vat/${parts.number}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { valid: false };
    return parseVies(await res.json());
  } catch {
    return { valid: false };
  }
}
