// Derives a Supabase-auth-compatible password from a 4-digit PIN.
// Supabase Auth requires a minimum password length (default 6), so we prefix
// the PIN deterministically. The real protection comes from the synthetic,
// non-guessable email address, Supabase rate limiting, and RLS isolation.
export function pinToPassword(pin: string): string {
  return `familyapp-pin-${pin}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
