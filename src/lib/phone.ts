// Mirror of backend utils/phone.ts — keep the two in sync manually.
//
// Normalizes a Pakistani mobile number to its canonical local form
// (03XXXXXXXXX). Accepts +92 / 0092 / 92 prefixes, a missing leading zero,
// spaces, dashes and dots; returns null for anything that isn't a valid PK
// mobile. Forms validate with this BEFORE submitting and send the
// normalized value, so phone-keyed matching (order tracking, booking
// dedupe, appointment→customer matching) stays consistent.
export function normalizePkMobile(input: string): string | null {
  const s = input || "";
  // Letters are never part of a phone number — reject outright rather than
  // stripping them (otherwise "0300abc1234567" would silently pass).
  if (/[A-Za-z]/.test(s)) return null;
  let d = s.replace(/\D/g, "");
  if (d.startsWith("0092")) d = "0" + d.slice(4);
  else if (d.length === 12 && d.startsWith("92")) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("3")) d = "0" + d;
  return /^03\d{9}$/.test(d) ? d : null;
}

export const PHONE_ERROR =
  "Enter a valid Pakistani mobile number, e.g. 0300 1234567";
