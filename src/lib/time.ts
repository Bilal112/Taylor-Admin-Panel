// "14:00" -> "2:00 PM". Display-only: storage and the API stay 24-hour
// HH:MM everywhere; convert at the last moment before rendering.
export function to12h(t: string): string {
  const [h, m] = (t || "").split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}
