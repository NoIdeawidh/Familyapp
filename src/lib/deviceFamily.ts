// Remembers which family this device last logged into, so players can use the
// "select character + PIN" flow without re-entering a family identifier.
// This is a convenience cache only — all real access control is enforced by RLS.

const KEY = 'familyapp.device_family';

interface DeviceFamily {
  id: string;
  name: string;
}

export function rememberFamily(family: DeviceFamily): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(family));
  } catch {
    // ignore storage errors
  }
}

export function getRememberedFamily(): DeviceFamily | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeviceFamily) : null;
  } catch {
    return null;
  }
}

export function forgetFamily(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
