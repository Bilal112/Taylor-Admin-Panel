// Build a wa.me deep link that opens WhatsApp with a prefilled message.
// wa.me needs the number in international format with no plus sign or
// punctuation. Local Pakistani numbers (03XX…) are converted to 923XX…;
// anything already carrying a country code passes through digits-only.
export function waLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "92" + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
