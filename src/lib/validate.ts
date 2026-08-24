// Mongo ObjectId shape check — 24 hex chars. Used to validate route params
// (customer/order [id]) before they're interpolated into an API URL. This
// isn't a security boundary by itself (the backend validates/authorizes
// every request regardless), but it stops a malformed or deliberately
// crafted URL segment from ever reaching a request, and gives a clean
// "not found" instead of a confusing raw 500/cast-error response.
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export const isValidObjectId = (id: unknown): id is string =>
  typeof id === "string" && OBJECT_ID_RE.test(id);
