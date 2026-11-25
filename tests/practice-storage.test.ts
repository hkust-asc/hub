import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/practice/engine/game.ts";
import { storageKey } from "../src/practice/engine/storage.ts";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

test("unlock, history and cards survive a reload; reset also works with only getItem/setItem", () => {
  const storage = new MemoryStorage();
  const legacyKey = "linux-xray.act1";
  storage.setItem(legacyKey, '{"completed":[1,2],"cards":[],"history":[]}');
  const game = new Game(storage);
  assert.equal(game.select(2), false, "another app's progress is independent");
  const history = ["ls -a", "cat .vault/.access_key", "cat .vault/.access_key", "ls >"];
  for (const command of [...history, "  "]) game.run(command);
  const resumed = new Game(storage);
  assert.equal(resumed.level.id, 2);
  assert.deepEqual(resumed.store.state, {
    completed: [1], cards: ["filesystem", "paths", "dotfiles", "help"], history,
  });

  resumed.reset();
  assert.equal(resumed.level.id, 1);
  const fresh = new Game(storage);
  assert.equal(fresh.isUnlocked(2), false);
  assert.deepEqual(fresh.store.state, { completed: [], cards: [], history: [] });
  assert.equal(storage.getItem(legacyKey), '{"completed":[1,2],"cards":[],"history":[]}');
});

test("denied storage reports memory-only progress without interrupting play or reset", () => {
  const denied = (): never => { throw new Error("storage disabled"); };
  const game = new Game({ getItem: denied, setItem: denied, removeItem: denied });
  assert.equal(game.store.persistence, "unavailable");
  game.run("ls -a");
  assert.ok(game.run("cat .vault/.access_key").completed);
  assert.ok(game.select(2));
  game.reset();
  assert.deepEqual(game.store.state, { completed: [], cards: [], history: [] });
  assert.equal(game.store.persistence, "unavailable");
  assert.equal(new Game().store.persistence, "memory");
});

test("damaged saves recover usable fields, retain repeated history, and can be saved again", () => {
  for (const raw of ["{", "null", "[]", '{"completed":"one","cards":false}']) {
    const storage = new MemoryStorage();
    storage.setItem(storageKey, raw);
    const game = new Game(storage);
    assert.equal(game.store.persistence, "corrupt", raw);
    assert.deepEqual(game.store.state, { completed: [], cards: [], history: [] });
    game.run("ls");
    assert.equal(game.store.persistence, "available");
    assert.deepEqual(new Game(storage).store.state.history, ["ls"]);
  }
  const storage = new MemoryStorage();
  storage.setItem(storageKey, JSON.stringify({
    completed: [1, "2", 1], cards: ["paths", null, "paths"], history: ["pwd", 5, ...Array(100).fill("ls")],
  }));
  const game = new Game(storage);
  assert.equal(game.store.persistence, "corrupt");
  assert.deepEqual(game.store.state, { completed: [1], cards: ["paths"], history: Array(100).fill("ls") });
  game.run("cd /");
  assert.deepEqual(new Game(storage).store.state.history, [...Array(99).fill("ls"), "cd /"]);
});

test("legacy hpc4-anatomy practice saves load under the hub key and stay cleared after reset", () => {
  const withRemove = {
    data: new Map<string, string>([
      ["hpc4-anatomy.practice.act1", JSON.stringify({ completed: [1], cards: ["paths"], history: ["ls -a"] })],
    ]),
    getItem(key: string): string | null { return this.data.get(key) ?? null; },
    setItem(key: string, value: string): void { this.data.set(key, value); },
    removeItem(key: string): void { this.data.delete(key); },
  };
  const migrated = new Game(withRemove);
  assert.equal(migrated.level.id, 2);
  assert.deepEqual(migrated.store.state, { completed: [1], cards: ["paths"], history: ["ls -a"] });

  migrated.reset();
  assert.deepEqual(new Game(withRemove).store.state, { completed: [], cards: [], history: [] });
  assert.equal(withRemove.getItem("hpc4-anatomy.practice.act1"), null);

  const withoutRemove = new MemoryStorage();
  withoutRemove.setItem("hpc4-anatomy.practice.act1", JSON.stringify({ completed: [1], cards: ["paths"], history: ["pwd"] }));
  const fallback = new Game(withoutRemove);
  assert.equal(fallback.level.id, 2);
  fallback.reset();
  assert.deepEqual(new Game(withoutRemove).store.state, { completed: [], cards: [], history: [] });
});
