/**
 * Mandi/crop config — HomeScreen aur MandiInfoScreen dono ke liye ek hi source of truth.
 *
 * Pehle dono screens apni alag hardcoded list rakhte the, isliye UP choose karne par
 * bhi Mandi Info screen Delhi ki mandis dikhata tha. Naya mandi ya crop add karna ho
 * to sirf yahan badlo.
 *
 * UP mein sirf Prayagraj APMC hai, aur usme sirf Tomato/Potato/Onion: AGMARKNET pe
 * Prayagraj district ki baaki mandis (Sirsa/Ajuha/Jasra) bahut kam din report karti
 * hain, aur baaki commodities report hi nahi hoti.
 * Backend/daily_scrape.py ka UP_MARKETS / UP_CROPS isi se match karta hai.
 */

export type StateKey = 'Delhi' | 'UP';

export const STATES: StateKey[] = ['Delhi', 'UP'];

export const MANDI_MAP: Record<string, { labelKey: string; sublabelKey: string; shortKey: string }> = {
  'Azadpur APMC':   { labelKey: 'mandi.azadpur',   sublabelKey: 'mandi.azadpur.desc',   shortKey: 'mandi.azadpur.short' },
  'Keshopur APMC':  { labelKey: 'mandi.keshopur',  sublabelKey: 'mandi.keshopur.desc',  shortKey: 'mandi.keshopur.short' },
  'Prayagraj APMC': { labelKey: 'mandi.prayagraj', sublabelKey: 'mandi.prayagraj.desc', shortKey: 'mandi.prayagraj.short' },
};

export const MARKETS_BY_STATE: Record<StateKey, { value: string; transportCost: number }[]> = {
  Delhi: [
    { value: 'Azadpur APMC',  transportCost: 120 },
    { value: 'Keshopur APMC', transportCost: 180 },
  ],
  UP: [
    { value: 'Prayagraj APMC', transportCost: 90 },
  ],
};

export const CROPS_BY_STATE: Record<StateKey, { name: string }[]> = {
  Delhi: [
    { name: 'Tomato' },
    { name: 'Potato' },
    { name: 'Onion' },
    { name: 'Spinach' },
  ],
  UP: [
    { name: 'Tomato' },
    { name: 'Potato' },
    { name: 'Onion' },
  ],
};

/** localStorage se chuna hua state — kuch set na ho to Delhi. */
export function getSelectedState(): StateKey {
  const s = localStorage.getItem('selectedState');
  return s === 'UP' || s === 'Delhi' ? s : 'Delhi';
}

/** Kisi market ka state — market ka naam pehchan ke. */
export function stateOfMarket(market: string): StateKey | null {
  for (const st of STATES) {
    if (MARKETS_BY_STATE[st].some(m => m.value === market)) return st;
  }
  return null;
}

/**
 * Chune hue state ka market list, aur uska default market.
 * Agar localStorage ka market is state ka nahi hai (state abhi badla hai) to
 * state ka pehla market default hota hai — warna UP choose karke Delhi ka
 * data dikhne lagta hai.
 */
export function marketsForState(state: StateKey) {
  return MARKETS_BY_STATE[state];
}

export function defaultMarketForState(state: StateKey): string {
  const saved = localStorage.getItem('selectedMarket');
  if (saved && stateOfMarket(saved) === state) return saved;
  return MARKETS_BY_STATE[state][0].value;
}

export function cropsForState(state: StateKey) {
  return CROPS_BY_STATE[state];
}
