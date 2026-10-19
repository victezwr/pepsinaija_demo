// localStorage can throw (private mode, blocked storage); every access goes through here.
export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(`dsm:${key}`);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(`dsm:${key}`, value);
  } catch {
    /* preference is optional */
  }
}
