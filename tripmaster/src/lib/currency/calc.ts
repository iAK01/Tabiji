// The converter's keypad: an expression typed a key at a time ("450×3+20"),
// worked out with × and ÷ before + and −, the way a phone calculator does.

export const OPS = ['+', '−', '×', '÷'] as const;
export type Op = typeof OPS[number];
export type Key = Op | '.' | 'back' | 'clear' | '=' | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

const isOp = (c: string | undefined): c is Op => !!c && (OPS as readonly string[]).includes(c);
const MAX_WHOLE    = 9;   // digits before the point
const MAX_DECIMALS = 2;

function lastNumber(expr: string): string {
  const m = expr.match(/[\d.]*$/);
  return m ? m[0] : '';
}

/** The expression after pressing `key`. */
export function press(expr: string, key: Key): string {
  if (key === 'clear') return '';
  if (key === 'back')  return expr.slice(0, -1);
  if (key === '=') {
    const v = evaluate(expr);
    return v === null || Math.abs(v) >= 10 ** MAX_WHOLE ? expr : toInput(v);
  }
  if (isOp(key)) {
    if (!expr || expr === '−') return expr;
    const trimmed = expr.endsWith('.') ? expr.slice(0, -1) : expr;
    return isOp(trimmed.at(-1)) ? trimmed.slice(0, -1) + key : trimmed + key;
  }
  const num = lastNumber(expr);
  if (key === '.') {
    if (num.includes('.')) return expr;
    return expr + (num ? '.' : '0.');
  }
  // A digit
  const [whole, frac] = num.split('.');
  if (frac !== undefined ? frac.length >= MAX_DECIMALS : whole.length >= MAX_WHOLE) return expr;
  if (num === '0') return expr.slice(0, -1) + key;
  return expr + key;
}

/** The value of the expression (a trailing operator ignored); null if there's nothing to work out. */
export function evaluate(expr: string): number | null {
  let s = expr;
  while (s && (isOp(s.at(-1)) || s.endsWith('.'))) s = s.slice(0, -1);
  if (!s) return null;
  const parts = s.split(/([+−×÷])/);
  // parts alternate number, op, number, …
  let total = 0;
  let sign  = 1;
  let term  = Number(parts[0]);
  if (!Number.isFinite(term)) return null;
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i] as Op;
    const n  = Number(parts[i + 1]);
    if (!Number.isFinite(n)) return null;
    if (op === '×') term *= n;
    else if (op === '÷') {
      if (n === 0) return null;
      term /= n;
    } else {
      total += sign * term;
      sign = op === '+' ? 1 : -1;
      term = n;
    }
  }
  const v = total + sign * term;
  return Number.isFinite(v) ? v : null;
}

/** True when the expression is more than one number, so its total is worth showing. */
export const hasSum = (expr: string) => /[+−×÷]\d/.test(expr);

function toInput(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(r).replace('-', '−');
}

/** The expression for display: thousands grouped, operators spaced. */
export function showExpr(expr: string): string {
  return expr.split(/([+−×÷])/).map(part => {
    if (isOp(part)) return ` ${part} `;
    const [whole, frac] = part.split('.');
    const grouped = whole ? Number(whole).toLocaleString('en-IE') : (frac !== undefined ? '0' : '');
    return frac !== undefined ? `${grouped}.${frac}` : grouped;
  }).join('');
}

// ─── Money ────────────────────────────────────────────────────────────────────

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(code: string, whole: boolean): Intl.NumberFormat {
  const key = `${code}:${whole}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-IE', {
        style: 'currency', currency: code,
        ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
      });
    } catch {
      f = new Intl.NumberFormat('en-IE', whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    formatters.set(key, f);
  }
  return f;
}

/** An amount in its currency — "€41.06", "MAD 450" (no .00 on whole amounts). */
export function money(amount: number, code: string): string {
  const whole = Math.abs(Math.round(amount * 100) % 100) === 0;
  return formatter(code, whole).format(amount);
}

/**
 * The rate the readable way round: 1 of whichever currency is worth more —
 * "€1 = MAD 10.96", "£1 = €1.16". `rate` is units of local to 1 home.
 */
export function rateLine(rate: number, home: string, local: string): string {
  const [one, other, value] = rate >= 1 ? [home, local, rate] : [local, home, 1 / rate];
  const digits = value >= 100 ? 0 : value >= 10 ? 2 : 3;
  let shown: string;
  try {
    shown = new Intl.NumberFormat('en-IE', {
      style: 'currency', currency: other, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
  } catch {
    shown = `${other} ${value.toFixed(digits)}`;
  }
  return `${money(1, one)} = ${shown}`;
}

/**
 * Round amounts of `code` for a quick look-up, sized so they span roughly 1 to
 * 100 of home: MAD 10…1,000; VND 10,000…1,000,000; £1…£100. `perHome` is units of
 * `code` to 1 home (1 when `code` is home).
 */
export function lookupAmounts(perHome: number): number[] {
  const unit = 10 ** Math.max(0, Math.round(Math.log10(perHome)));
  return [1, 2, 5, 10, 20, 50, 100].map(n => n * unit);
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export const PERCENTS_OFF = [10, 20, 25, 30, 40, 50, 60, 70];

export interface MultiBuy { label: string; items: number; payFor: number }

// payFor: how many full prices you pay for `items`
export const MULTI_BUYS: MultiBuy[] = [
  { label: 'Buy 1, get 1 free',        items: 2, payFor: 1 },
  { label: 'Buy 1, get 1 half price',  items: 2, payFor: 1.5 },
  { label: '3 for 2',                  items: 3, payFor: 2 },
  { label: 'Buy 2, get 1 half price',  items: 3, payFor: 2.5 },
  { label: '4 for 3',                  items: 4, payFor: 3 },
];
