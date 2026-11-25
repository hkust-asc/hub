import { levels, type Level, type LevelState, type Proposal } from "./levels/index.ts";
import { Shell, type Result } from "./shell.ts";
import { progressStore, type ProgressStore, type StorageAdapter } from "./storage.ts";

export interface GameResult extends Result { feedback: string[]; completed: boolean }
export interface Decision { accepted: boolean; explanation: string; completed: boolean }

export class Game {
  readonly levels: readonly Level[];
  readonly store: ProgressStore;
  level!: Level;
  shell!: Shell;
  state!: LevelState;
  proposalIndex = 0;
  unlockAll = false;

  constructor(storage?: StorageAdapter, registry: readonly Level[] = levels) {
    this.levels = registry;
    this.store = progressStore(storage);
    const first = registry.find(level => !this.isComplete(level.id) && this.isUnlocked(level.id)) ?? registry.at(-1);
    if (!first) throw new Error("Practice needs at least one level");
    this.select(first.id);
  }

  setUnlockAll(enabled: boolean): void {
    this.unlockAll = enabled;
  }

  isComplete(id: number): boolean {
    return this.store.state.completed.includes(id);
  }

  isUnlocked(id: number): boolean {
    const index = this.levels.findIndex(level => level.id === id);
    return index >= 0 && (this.unlockAll || index === 0 || this.isComplete(this.levels[index - 1].id));
  }

  select(id: number): boolean {
    const level = this.levels.find(candidate => candidate.id === id);
    if (!level || !this.isUnlocked(id)) return false;
    this.level = level;
    this.shell = new Shell(level.snapshot);
    this.state = {};
    this.proposalIndex = this.isComplete(id) ? level.proposals?.length ?? 0 : 0;
    level.setup?.(this.shell, this.state);
    return true;
  }

  complete(): boolean {
    if (this.isComplete(this.level.id)) return false;
    this.store.complete(this.level.id, this.level.cards);
    return true;
  }

  run(input: string): GameResult {
    if (input.trim()) this.store.remember(input);
    const result = this.shell.run(input);
    const feedback: string[] = [];
    const report = (message: string) => { feedback.push(message); };
    let completed = false;
    for (const event of result.stages) {
      if (event.code === 0 && !event.help && this.level.observe?.({ shell: this.shell, state: this.state, event, result, report })) {
        completed = this.complete() || completed;
      }
    }
    return { ...result, feedback, completed };
  }

  get proposal(): Proposal | undefined {
    return this.level.proposals?.[this.proposalIndex];
  }

  decide(verdict: string): Decision | null {
    const proposal = this.proposal;
    if (!proposal || (verdict !== "approve" && verdict !== "reject")) return null;
    const { verdict: expected, explanation } = proposal;
    if (verdict !== expected) return { accepted: false, explanation, completed: false };
    this.proposalIndex++;
    return { accepted: true, explanation, completed: !this.proposal && this.complete() };
  }

  reset(): void {
    this.store.reset();
    this.select(this.levels[0].id);
  }
}
