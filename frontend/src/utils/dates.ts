// ============================================================
// Date of birth as written on NSRP Form 1: "DATE OF BIRTH (mm/dd/yyyy)".
// Job seekers type and see mm/dd/yyyy; the app stores and sends YYYY-MM-DD (unchanged API and database).
// While typing, the form keeps the typed text until it is a complete real date, so a save can be refused
// with a clear message instead of sending a half-typed date.
// ============================================================

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MDY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isRealDate(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Today's date on the phone, as YYYY-MM-DD.
export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// '1999-08-22' -> '08/22/1999'. Anything else is returned unchanged.
export function isoToMdy(value?: string | null) {
  const m = ISO.exec(String(value ?? '').slice(0, 10));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : String(value ?? '');
}

// '08/22/1999' -> '1999-08-22' when it is a real date; otherwise null.
export function mdyToIso(text: string) {
  const m = MDY.exec(text.trim());
  if (!m || !isRealDate(+m[3], +m[1], +m[2])) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

// Read-only views: mm/dd/yyyy, without timezone conversion.
export function formatBirthDate(value?: string | null) {
  if (!value) return '';
  return isoToMdy(String(value).slice(0, 10));
}

// Typing aid: keeps digits only and adds the slashes (mm/dd/yyyy).
export function maskMdy(text: string) {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// The form value is YYYY-MM-DD when complete and real, otherwise the typed text. Blank is allowed here
// (the required-items list says when it is still missing). No minimum age is applied.
export function birthDateError(value?: string | null) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const iso = ISO.exec(v);
  if (iso) {
    if (!isRealDate(+iso[1], +iso[2], +iso[3])) return 'Date of birth is not a real date. Check the month and day.';
    if (v > todayIso()) return 'Date of birth cannot be in the future.';
    return null;
  }
  if (MDY.test(v)) return 'Date of birth is not a real date. Check the month and day.';
  return 'Enter the date of birth as mm/dd/yyyy, for example 05/14/2000.';
}
