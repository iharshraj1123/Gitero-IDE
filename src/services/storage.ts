import { isNative } from './neutralino';

function toNativeKey(rawKey: string): { nativeKey: string; isWrapped: boolean } {
  if (/^[a-zA-Z0-9_-]{1,50}$/.test(rawKey)) {
    return { nativeKey: rawKey, isWrapped: false };
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < rawKey.length; i++) {
    const ch = rawKey.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
  }
  const hashHex = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  const safePrefix = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
  const nativeKey = `k_${safePrefix}_${hashHex}`.slice(0, 50);
  return { nativeKey, isWrapped: true };
}

class PersistentStorageService {
  private initialized = false;
  private origSetItem: ((key: string, value: string) => void) | null = null;
  private origRemoveItem: ((key: string) => void) | null = null;
  private origClear: (() => void) | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;

    if (typeof window !== 'undefined' && window.localStorage) {
      this.origSetItem = window.localStorage.setItem.bind(window.localStorage);
      this.origRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
      this.origClear = window.localStorage.clear.bind(window.localStorage);

      if (isNative() && window.Neutralino?.storage) {
        try {
          const keys: string[] = await window.Neutralino.storage.getKeys();
          if (Array.isArray(keys) && keys.length > 0) {
            for (const key of keys) {
              try {
                const val = await window.Neutralino.storage.getData(key);
                if (val !== null && val !== undefined) {
                  let rawKey = key;
                  let rawVal = val;
                  if (typeof val === 'string' && val.startsWith('{"__gitero_native_wrapper":true')) {
                    try {
                      const parsed = JSON.parse(val);
                      if (parsed && parsed.__gitero_native_wrapper && parsed.rawKey) {
                        rawKey = parsed.rawKey;
                        rawVal = parsed.value;
                      }
                    } catch {
                      // fallback to val
                    }
                  } else if (typeof val === 'object' && val !== null && (val as any).__gitero_native_wrapper) {
                    rawKey = (val as any).rawKey;
                    rawVal = (val as any).value;
                  }
                  this.origSetItem(rawKey, typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal));
                }
              } catch (errKey) {
                console.warn(`[PersistentStorage] Could not load key "${key}":`, errKey);
              }
            }
          } else {
            // First run on new system: persist existing localStorage data to Neutralino storage
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i);
              if (k) {
                const v = window.localStorage.getItem(k);
                if (v !== null) {
                  const { nativeKey, isWrapped } = toNativeKey(k);
                  const dataToStore = isWrapped
                    ? JSON.stringify({ __gitero_native_wrapper: true, rawKey: k, value: String(v) })
                    : String(v);
                  window.Neutralino.storage.setData(nativeKey, dataToStore).catch(() => {});
                }
              }
            }
          }
        } catch (err) {
          console.warn('[PersistentStorage] Failed to synchronize keys from Neutralino.storage:', err);
        }

        // Intercept window.localStorage to automatically mirror all writes to Neutralino storage
        window.localStorage.setItem = (key: string, value: string) => {
          this.origSetItem?.(key, String(value));
          if (isNative() && window.Neutralino?.storage) {
            const { nativeKey, isWrapped } = toNativeKey(key);
            const dataToStore = isWrapped
              ? JSON.stringify({ __gitero_native_wrapper: true, rawKey: key, value: String(value) })
              : String(value);
            window.Neutralino.storage.setData(nativeKey, dataToStore).catch((e: any) => {
              console.warn(`[PersistentStorage] Failed to save key "${key}" to native storage:`, e);
            });
          }
        };

        window.localStorage.removeItem = (key: string) => {
          this.origRemoveItem?.(key);
          if (isNative() && window.Neutralino?.storage) {
            const { nativeKey } = toNativeKey(key);
            window.Neutralino.storage.setData(nativeKey, null).catch((e: any) => {
              console.warn(`[PersistentStorage] Failed to remove key "${key}" from native storage:`, e);
            });
          }
        };

        window.localStorage.clear = () => {
          this.origClear?.();
          if (isNative() && window.Neutralino?.storage) {
            window.Neutralino.storage.getKeys().then((keys: string[]) => {
              for (const k of keys) {
                window.Neutralino.storage.setData(k, null).catch(() => {});
              }
            }).catch(() => {});
          }
        };
      }
    }

    this.initialized = true;
    console.log('[PersistentStorage] Initialized successfully');
  }

  getItem(key: string): string | null {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  }

  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  }
}

export const persistentStorage = new PersistentStorageService();
