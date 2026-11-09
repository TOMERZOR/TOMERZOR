// Lengths are stored in centimetres; shown in cm or inches.
let units = 'cm';
export const setUnits = u => { units = u === 'in' ? 'in' : 'cm'; };
export const getUnits = () => units;

export function len(cm, { unit = true } = {}) {
  if (cm == null || Number.isNaN(cm)) return '';
  if (units === 'in') {
    const v = cm / 2.54;
    return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}${unit ? '″' : ''}`;
  }
  const v = cm >= 100 ? Math.round(cm) : Math.round(cm * 10) / 10;
  return `${v}${unit ? ' ס״מ' : ''}`;
}

/** "220 × 95 × 82 ס״מ" in the order width × depth × height. */
export function dimsText(d) {
  if (!d) return '';
  return `${len(d.w, { unit: false })} × ${len(d.d, { unit: false })} × ${len(d.h, { unit: false })} ${units === 'in' ? 'אינץ׳' : 'ס״מ'}`;
}

/** Number shown in an input for a cm value, and back. */
export const toField = cm => (units === 'in' ? Math.round((cm / 2.54) * 10) / 10 : Math.round(cm));
export const fromField = v => (units === 'in' ? Number(v) * 2.54 : Number(v));

export function price(amount, currency = 'ILS') {
  if (amount == null || amount === '' || Number.isNaN(Number(amount))) return '';
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: currency || 'ILS', maximumFractionDigits: 0 }).format(Number(amount));
  } catch {
    return `${Math.round(Number(amount))} ${currency || ''}`.trim();
  }
}
