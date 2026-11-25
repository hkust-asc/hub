import { commands, pathCommands } from "./commands.ts";
import { basename, createVFS, HOME, isExecutable, resolvePath, WORKSPACE, type VFS, type VFSSnapshot } from "./vfs.ts";
import { builtinNames, describe, lookup } from "./etymology.ts";
import { expandWord, parse, parseFlags, tokenize, type RedirectOperator, type Segment, type Stage } from "./parser.ts";

export { parse, parseFlags, tokenize } from "./parser.ts";
export { builtinNames } from "./etymology.ts";

export interface Output { stdout: string; stderr: string; code: number }
export type CommandOutput = string | Partial<Output> | void;
export type Stream = "stdout" | "stderr";
export interface Write { stream: Stream; path: string; operator: RedirectOperator; text: string }
export interface Event extends Output {
  name: string;
  args: string[];
  cwd: string;
  stdin: string;
  reads: string[];
  revealed: string[];
  writes: Write[];
  vfsAtExecution?: VFSSnapshot;
  help?: boolean;
  clear?: boolean;
  executed?: string;
  seenPids?: number[];
  killed?: number;
}
export interface Result extends Output { stages: Event[]; clear: boolean }
export interface Process { pid: number; cpu: number; memory: number; name: string }
export const baseProcesses: Process[] = [
  { pid: 101, cpu: 0.1, memory: 12, name: "cadet-shell" },
  { pid: 207, cpu: 0.4, memory: 24, name: "telemetryd" },
];
export interface ShellOptions { vfs?: VFS; cwd?: string; processes?: readonly Process[] }

interface Sink extends Omit<Write, "text"> { write(text: string): void }
const errorLine = (error: unknown) => `${error instanceof Error ? error.message : String(error)}\n`;

export class Shell {
  readonly vfs: VFS;
  readonly revealed = new Set<string>();
  cwd: string;
  previous: string | null = null;
  processes: Process[];
  private depth = 0;
  readonly env: Record<string, string> = Object.assign(Object.create(null), { HOME, USER: "cadet", PATH: "/usr/bin:/bin" });

  constructor({ vfs = createVFS(), cwd = WORKSPACE, processes = baseProcesses }: ShellOptions = {}) {
    this.vfs = vfs;
    this.cwd = cwd;
    this.processes = processes.map(proc => ({ ...proc }));
  }

  path(value: string): string {
    return resolvePath(value, this.cwd);
  }

  get prompt(): string {
    const path = this.cwd === HOME || this.cwd.startsWith(`${HOME}/`) ? `~${this.cwd.slice(HOME.length)}` : this.cwd;
    return `cadet@asc-node:${path}$ `;
  }

  get pathDirectories(): string[] {
    return this.env.PATH.split(":").map(path => this.path(path));
  }

  executable(path: string | null): boolean {
    return path !== null && isExecutable(this.vfs.get(path));
  }

  find(name: string): string | null {
    if (name.includes("/")) {
      const path = this.path(name);
      return this.executable(path) ? path : null;
    }
    for (const directory of this.pathDirectories) {
      const path = resolvePath(name, directory);
      if (this.executable(path) || (directory === "/usr/bin" && pathCommands.has(name))) return path;
    }
    return null;
  }

  complete(fragment: string, commandPosition: boolean): string[] {
    if (commandPosition && !fragment.includes("/")) {
      const programs = this.pathDirectories.flatMap(directory => this.vfs.get(directory)?.type === "directory"
        ? this.vfs.list(directory).filter(path => this.executable(path)).map(basename) : []);
      return [...new Set([...builtinNames, ...programs])].filter(name => name.startsWith(fragment)).sort();
    }
    const slash = fragment.lastIndexOf("/");
    const prefix = fragment.slice(0, slash + 1);
    const query = fragment.slice(slash + 1);
    const directory = this.path(prefix || ".");
    if (this.vfs.get(directory)?.type !== "directory") return [];
    return this.vfs.list(directory).filter(path => {
      const name = basename(path);
      return name.startsWith(query) && (!name.startsWith(".") || query.startsWith(".") || this.revealed.has(directory));
    }).map(path => `${prefix}${basename(path)}${this.vfs.get(path)?.type === "directory" ? "/" : ""}`);
  }

  runFile(text: string): Output {
    if (this.depth >= 8) throw new Error("script nesting limit reached");
    this.depth++;
    const result: Output = { stdout: "", stderr: "", code: 0 };
    try {
      for (const line of text.split("\n")) {
        if (!line.trim() || line.trimStart().startsWith("#")) continue;
        const step = this.run(line);
        result.stdout += step.stdout;
        result.stderr += step.stderr;
        result.code = step.code;
      }
      return result;
    } finally {
      this.depth--;
    }
  }

  execute(event: Event): CommandOutput {
    const { name, args, stdin } = event;
    const direct = name.includes("/");
    const path = direct ? this.path(name) : this.find(name);
    const file = path ? this.vfs.get(path) : undefined;
    const builtin = !direct && Object.hasOwn(commands, name);
    if ((builtin || isExecutable(file)) && parseFlags(args).flags.has("help") && lookup(basename(name))) {
      event.help = true;
      return describe(basename(name), "help");
    }
    if (builtin) return commands[name](this, args, stdin, event);
    if (!path || !file) throw new Error(`${name}: command not found. Try tldr ls or <command> --help for known commands.`);
    if (file.type !== "file" || !isExecutable(file)) throw new Error(`${name}: permission denied`);
    event.executed = path;
    return file.program ? file.program(this, args, stdin) : this.runFile(file.text);
  }

  run(input: string): Result {
    const result: Result = { stdout: "", stderr: "", code: 0, stages: [], clear: false };
    let stages: Stage[];
    try {
      stages = parse(input);
    } catch (error) {
      return { ...result, stderr: errorLine(error), code: 2 };
    }
    let stdin = "";
    for (const [index, stage] of stages.entries()) {
      const [name, ...args] = stage.words.map(word => expandWord(word, this.env));
      const event: Event = { name, args, cwd: this.cwd, stdin, stdout: "", stderr: "", code: 0, reads: [], revealed: [], writes: [] };
      result.stages.push(event);
      const sinks: Partial<Record<Stream, Sink>> = {};
      try {
        for (const redirect of stage.redirects) {
          const stream = redirect.operator === "2>" ? "stderr" : "stdout";
          const path = this.path(expandWord(redirect.target, this.env));
          const write = this.vfs.openOutput(path, redirect.operator === ">>");
          sinks[stream] = { stream, path, operator: redirect.operator, write };
        }
        // Redirects may truncate files; later stages may move, edit, or delete them.
        event.vfsAtExecution = this.vfs.snapshot();
        const output = this.execute(event);
        if (typeof output === "string") event.stdout = output;
        else if (output) Object.assign(event, output);
      } catch (error) {
        event.stderr = errorLine(error);
        event.code = 1;
      }
      const visible = { stdout: event.stdout, stderr: event.stderr };
      for (const { stream, path, operator, write } of Object.values(sinks)) {
        write(event[stream]);
        event.writes.push({ stream, path, operator, text: event[stream] });
        visible[stream] = "";
      }
      stdin = visible.stdout;
      if (index === stages.length - 1) result.stdout = stdin;
      result.stderr += visible.stderr;
      result.code = event.code;
      result.clear ||= Boolean(event.clear);
    }
    return result;
  }
}

export type TokenRole = "argument" | "operator" | "path" | "command" | "danger" | "flag";
export interface XrayToken {
  type: TokenRole;
  value: string;
  start: number;
  end: number;
  segments?: Segment[];
  label: string;
  origin?: string;
}

const pathOperands = new Set(["ls", "cd", "cat", "head", "tail", "mkdir", "touch", "mv", "cp", "rm", "wc", "source", "."]);

export function xray(input: string, cwd: string = WORKSPACE, host = "asc-node"): XrayToken[] {
  let command = "";
  let expectTarget = false;
  return tokenize(input, { partial: true }).map(token => {
    const { value } = token;
    let type: TokenRole = "argument";
    if (token.type === "operator") {
      type = "operator";
      if (value === "|") command = "";
      else expectTarget = true;
    } else if (expectTarget) {
      type = "path";
      expectTarget = false;
    } else if (!command) {
      command = value;
      type = host.startsWith("login-node") && basename(command) === "hpl_benchmark" ? "danger" : "command";
    } else if (command === "rm" && resolvePath(value, cwd) === "/") {
      type = "danger";
    } else if ((command === "rm" && (/^-[rf]+$/.test(value) || /^--(recursive|force)$/.test(value)))
      || (host.startsWith("login-node") && basename(command) === "hpl_benchmark" && (value.startsWith("--threads") || /^\d+$/.test(value)))) {
      type = "danger";
    } else if (/^[-+][-\w]/.test(value)) {
      type = "flag";
    } else if (value.includes("/") || value.startsWith(".") || value.startsWith("~") || pathOperands.has(command)) {
      type = "path";
    }
    return { ...token, type, label: input.slice(token.start, token.end), origin: type === "command" ? lookup(basename(command))?.[0] : undefined };
  });
}
