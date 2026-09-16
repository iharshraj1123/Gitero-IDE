import { isNative } from './neutralino';

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
                  this.origSetItem(key, typeof val === 'string' ? val : JSON.stringify(val));
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
                  window.Neutralino.storage.setData(k, v).catch(() => {});
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
            window.Neutralino.storage.setData(key, String(value)).catch((e: any) => {
              console.warn(`[PersistentStorage] Failed to save key "${key}" to native storage:`, e);
            });
          }
        };

        window.localStorage.removeItem = (key: string) => {
          this.origRemoveItem?.(key);
          if (isNative() && window.Neutralino?.storage) {
            window.Neutralino.storage.setData(key, null).catch((e: any) => {
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
