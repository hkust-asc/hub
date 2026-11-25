import type { CommandOutput, Shell } from "./shell.ts";

export const HOME = "/home/cadet";
export const WORKSPACE = `${HOME}/workspace`;

export interface DirectoryEntry { type: "directory"; mode: number }
export type Program = (shell: Shell, args: string[], stdin: string) => CommandOutput;
export interface FileEntry { type: "file"; mode: number; text: string; program?: Program }
export type Entry = DirectoryEntry | FileEntry;
export interface VFSSnapshot { get(path: string): Readonly<Entry> | undefined }

export function resolvePath(path: string, cwd: string = WORKSPACE): string {
  const expanded = path === "~" || path.startsWith("~/") ? HOME + path.slice(1) : path;
  const parts: string[] = [];
  for (const part of (expanded.startsWith("/") ? expanded : `${cwd}/${expanded}`).split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return `/${parts.join("/")}`;
}

export const basename = (path: string): string => path.split("/").at(-1) || "/";
export const dirname = (path: string): string => path.slice(0, path.lastIndexOf("/")) || "/";
export const isExecutable = (entry: Readonly<Entry> | undefined): boolean =>
  entry?.type === "file" && Boolean(entry.mode & 0o100);

export class VFS {
  readonly entries = new Map<string, Entry>([["/", { type: "directory", mode: 0o755 }]]);

  get(path: string): Entry | undefined {
    return this.entries.get(path);
  }

  snapshot(): VFSSnapshot {
    const entries = new Map([...this.entries].map(([path, entry]) => [path, Object.freeze({ ...entry })]));
    return Object.freeze({ get: (path: string) => entries.get(path) });
  }

  mkdir(path: string, parents = false): void {
    const existing = this.get(path);
    if (existing) {
      if (parents && existing.type === "directory") return;
      throw new Error(`${path}: already exists`);
    }
    if (parents && !this.get(dirname(path))) this.mkdir(dirname(path), true);
    this.requireDirectory(dirname(path));
    this.entries.set(path, { type: "directory", mode: 0o755 });
  }

  requireDirectory(path: string): void {
    if (this.get(path)?.type !== "directory") throw new Error(`${path}: not a directory`);
  }

  list(path: string): string[] {
    this.requireDirectory(path);
    return [...this.entries.keys()].filter(entry => entry !== path && dirname(entry) === path).sort();
  }

  file(path: string): FileEntry {
    const entry = this.get(path);
    if (entry?.type !== "file") throw new Error(`${path}: not a file`);
    return entry;
  }

  write(path: string, text = "", { append = false, mode = 0o644, program }: {
    append?: boolean; mode?: number; program?: Program;
  } = {}): void {
    if (path === "/dev/null") return;
    this.requireDirectory(dirname(path));
    if (this.get(path)) {
      const file = this.file(path);
      file.text = append ? file.text + text : text;
      if (text || !append) delete file.program;
    } else {
      this.entries.set(path, { type: "file", mode, text, program });
    }
  }

  openOutput(path: string, append: boolean): (text: string) => void {
    if (path === "/dev/null") return () => {};
    this.write(path, "", { append });
    const file = this.file(path);
    return text => {
      file.text += text;
      if (text) delete file.program;
    };
  }

  transfer(from: string, to: string, move: boolean): void {
    const entry = this.get(from);
    if (!entry) throw new Error(`${from}: no such file or directory`);
    if (this.get(to)?.type === "directory") to = resolvePath(basename(from), to);
    if (from === to || from === "/" || to.startsWith(`${from}/`)) throw new Error("invalid destination");
    this.requireDirectory(dirname(to));
    if (this.get(to)?.type === "directory") throw new Error(`${to}: directory already exists`);
    if (entry.type === "directory" && !move) throw new Error(`${from}: cp only copies files`);
    for (const [path, item] of [...this.entries]) {
      if (path !== from && !path.startsWith(`${from}/`)) continue;
      this.entries.set(to + path.slice(from.length), move ? item : { ...item });
      if (move) this.entries.delete(path);
    }
  }

  remove(path: string, { recursive, force }: { recursive?: boolean; force?: boolean } = {}): void {
    if (path === "/") throw new Error("refusing to remove the simulated root");
    const entry = this.get(path);
    if (!entry && !force) throw new Error(`${path}: no such file or directory`);
    if (entry?.type === "directory" && !recursive) throw new Error(`${path}: is a directory (requires -r)`);
    for (const key of this.entries.keys()) {
      if (key === path || key.startsWith(`${path}/`)) this.entries.delete(key);
    }
  }
}

export function createVFS(): VFS {
  const vfs = new VFS();
  for (const path of [WORKSPACE, `${HOME}/bin`, `${HOME}/downloads`, `${HOME}/.local/bin`, "/usr/bin", "/bin", "/tmp", "/dev"]) {
    vfs.mkdir(path, true);
  }
  vfs.write(`${HOME}/.bashrc`, "# Cadet shell settings\n");
  return vfs;
}
