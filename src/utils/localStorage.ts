export function getLocalStorage(key: string, defaultValue: boolean): boolean;
export function getLocalStorage<T>(key: string, defaultValue: T): T;

export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;

  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch (err) {
    console.log("Failed to get localStorage item", err);
    return defaultValue;
  }
}

export function setLocalStorage(key: string, value: boolean): void;
export function setLocalStorage<T>(key: string, value: T): void;

export function setLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.log("Failed to set localStorage item", err);
  }
}

export function removeLocalStorage(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.log("Failed to remove localStorage item", err);
  }
}
