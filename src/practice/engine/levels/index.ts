import type { Event, Result, Shell, ShellOptions } from "../shell.ts";
import type { FileEntry } from "../vfs.ts";
import level1 from "./level1.ts";
import level2 from "./level2.ts";
import level3 from "./level3.ts";
import level4 from "./level4.ts";
import level5 from "./level5.ts";
import level6 from "./level6.ts";

export type Visualizer = "tree" | "streams" | "env" | "processes";
export type Verdict = "approve" | "reject";
export interface Proposal { command: string; host?: string; verdict: Verdict; explanation: string }
export interface LevelState {
  workspaceRevealed?: boolean;
  routed?: boolean;
  extracted?: boolean;
  original?: FileEntry;
  hardware?: boolean;
  located?: boolean;
  stopped?: boolean;
}
export interface Observation {
  shell: Shell;
  state: LevelState;
  event: Event;
  result: Result;
  report(message: string): void;
}
export interface Level {
  id: number;
  title: string;
  objective: string;
  visualizer: Visualizer;
  hints: string[];
  cards: string[];
  proposals?: Proposal[];
  reward?: { title: string; teaser: string };
  snapshot?: ShellOptions;
  setup?(shell: Shell, state: LevelState): void;
  observe?(observation: Observation): boolean;
}

export const levels: Level[] = [level1, level2, level3, level4, level5, level6];
