export const storageKey = "hpc4-hub.practice.act1";
const legacyStorageKey = "hpc4-anatomy.practice.act1";
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}
export interface Progress { completed: number[]; cards: string[]; history: string[] }
export type Persistence = "memory" | "available" | "unavailable" | "corrupt";
export interface ProgressStore {
  readonly state: Progress;
  readonly persistence: Persistence;
  complete(id: number, cards: readonly string[]): void;
  remember(command: string): void;
  reset(): void;
}

const empty = (): Progress => ({ completed: [], cards: [], history: [] });

function restore(raw: string): { state: Progress; persistence: Persistence } {
  const saved: unknown = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { state: empty(), persistence: "corrupt" };
  let corrupt = false;
  function field<T>(key: keyof Progress, accept: (item: unknown) => item is T): T[] {
    const value = (saved as Record<string, unknown>)[key];
    if (!Array.isArray(value)) {
      corrupt = true;
      return [];
    }
    const filtered = value.filter(accept);
    if (filtered.length !== value.length) corrupt = true;
    return filtered;
  }
  const isString = (item: unknown): item is string => typeof item === "string";
  const state = {
    completed: [...new Set(field("completed", (item): item is number => typeof item === "number" && Number.isFinite(item)))],
    cards: [...new Set(field("cards", isString))],
    history: field("history", isString).slice(-100),
  };
  return { state, persistence: corrupt ? "corrupt" : "available" };
}

export function progressStore(storage?: StorageAdapter): ProgressStore {
  let state = empty();
  let persistence: Persistence = storage ? "available" : "memory";
  let saved: string | null = null;
  try {
    saved = storage?.getItem(storageKey) ?? storage?.getItem(legacyStorageKey) ?? null;
  } catch {
    persistence = "unavailable";
  }
  if (saved !== null) {
    try {
      ({ state, persistence } = restore(saved));
    } catch {
      persistence = "corrupt";
    }
  }
  const save = () => {
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
      persistence = "available";
    } catch {
      persistence = "unavailable";
    }
  };
  return {
    get state(): Progress { return state; },
    get persistence(): Persistence { return persistence; },
    complete(id: number, cards: readonly string[]): void {
      if (!state.completed.includes(id)) state.completed.push(id);
      state.cards = [...new Set([...state.cards, ...cards])];
      save();
    },
    remember(command: string): void {
      state.history.push(command);
      state.history = state.history.slice(-100);
      save();
    },
    reset(): void {
      state = empty();
      try {
        if (storage?.removeItem) {
          storage.removeItem(storageKey);
          storage.removeItem(legacyStorageKey);
          persistence = "available";
          return;
        }
      } catch {
        // Some adapters cannot remove keys but can still overwrite the saved progress.
      }
      save();
    },
  };
}
