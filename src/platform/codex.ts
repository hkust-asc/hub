/** Practice awards refer to the original Linux X-Ray IDs. Reference URLs use Atlas IDs. */
export interface CodexCard {
  title: string
  key?: string
  definition: string
  takeaway: string
  lookup: string
  review: string
}

export const codex: Readonly<Record<string, CodexCard>> = {
  filesystem: {
    title: 'The Linux filesystem', definition: 'Directories form a single tree rooted at /. Your home directory is a branch of that tree.',
    takeaway: 'A pathname describes where to look, not which disk holds the bytes.',
    lookup: 'Compare pwd, ls /, and ls ~.', review: 'Sketch the directories a proposed change would affect.',
  },
  paths: {
    title: 'Relative and absolute paths', definition: 'An absolute path starts at /. A relative path starts in the current working directory; the shell expands ~ to home.',
    takeaway: 'The same relative name can refer to different files in two terminals.',
    lookup: 'Check pwd before and after cd ..', review: 'Name the assumed working directory before resolving a relative path.',
  },
  dotfiles: {
    title: 'Dotfiles', definition: 'A leading dot hides a name from ordinary directory listings, not from processes with permission to read it.',
    takeaway: 'A file missing from ls output may still exist.',
    lookup: 'Compare ls with ls -a.', review: 'Check for hidden configuration before proposing an edit.',
  },
  help: {
    title: 'Command-line documentation', definition: '--help summarizes options; man explains behavior; tldr starts with examples when installed.',
    takeaway: 'Check flags against the version you will actually run.',
    lookup: 'Compare ls --help, man ls, and tldr ls.', review: 'Give an example and identify the manual entry for each flag.',
  },
  permissions: {
    title: 'File permissions', definition: 'Owner, group, and others have separate read, write, and execute permissions.',
    takeaway: 'Being able to read a script does not grant the right to execute it directly.',
    lookup: 'Inspect ls -l and man chmod.', review: 'Request the smallest change and say who gains access.',
  },
  'dot-slash': {
    title: 'Running ./tool', definition: 'A slash selects a path directly. Without a slash, an external command is normally found by searching PATH.',
    takeaway: './tool names this directory’s copy, not necessarily the installed one.',
    lookup: 'Compare which tool with ls -l ./tool.', review: 'State whether the command uses a path or a search.',
  },
  'standard-streams': {
    key: 'streams', title: 'Standard streams', definition: 'stdin, stdout, and stderr are separate channels. > redirects stdout (1); 2> redirects stderr (2).',
    takeaway: 'Redirecting output does not automatically collect diagnostics. A plain > can truncate the destination file.',
    lookup: 'Try echo sample > output.txt and inspect it with cat output.txt in the sandbox.',
    review: 'Trace all three channels. Name any existing files that would be overwritten.',
  },
  pipe: {
    title: 'Shell pipelines', definition: 'A pipe connects one process’s stdout to the next process’s stdin.',
    takeaway: 'stderr does not join that pipe by default.',
    lookup: 'Compare echo sample with echo sample | wc -l.', review: 'Describe what each stage receives and where its errors go.',
  },
  grep: {
    title: 'Filtering with grep', definition: 'grep selects lines matching a pattern; -i ignores case and -v selects nonmatches.',
    takeaway: 'Filtering the right channel matters as much as choosing a pattern.',
    lookup: 'Try echo Sensor | grep -i sensor.', review: 'Give one expected match and one expected nonmatch.',
  },
  path: {
    title: 'PATH lookup', definition: 'PATH is the ordered list of directories searched for an executable named without a slash.',
    takeaway: 'Selecting a different binary does not install a new one.',
    lookup: 'Compare echo "$PATH" with which grep.', review: 'Preserve other search directories and check which executable wins.',
  },
  environment: {
    title: 'Exported environment', definition: 'An exported variable is available to child programs. Its value belongs to an execution context, not to the machine as a whole.',
    takeaway: 'An interactive shell and a batch shell may have different environments.',
    lookup: 'Inspect env in the simulator only.', review: 'Use placeholders for secrets; do not paste an environment dump into a chat.',
  },
  bashrc: {
    title: 'Shell startup and source', definition: 'A Bash startup file can configure a shell. source reads commands into the current shell.',
    takeaway: 'Editing a file and applying its contents are separate operations.',
    lookup: 'Inspect cat ~/.bashrc before sourcing it.', review: 'Explain which future sessions will read a proposed setting.',
  },
  signals: {
    title: 'Processes and signals', definition: 'A PID identifies a running process. SIGTERM requests termination; SIGKILL does not let the process clean up.',
    takeaway: 'A disconnected terminal and a stopped process are different states.',
    lookup: 'Check ps aux in the simulation and read man kill.', review: 'Verify the process and owner before proposing a signal.',
  },
  'login-nodes': {
    key: 'login-node', title: 'Login nodes', definition: 'The shared entry point is for preparation, not heavy computation.',
    takeaway: 'A batch submission requests a separate execution context.',
    lookup: 'Use ps aux in the simulator; on a cluster, check the site’s usage policy.', review: 'Identify the node role before proposing a workload.',
  },
  hardware: {
    title: 'Reading hardware telemetry', definition: 'Hardware reports describe capacity; process reports show current consumers.',
    takeaway: 'A quiet login node is not an allocation.',
    lookup: 'Compare lscpu, free -h, and ps aux.', review: 'Separate capacity, current usage, and what the scheduler assigned.',
  },
  audit: {
    title: 'Reviewing proposed commands', definition: 'Read the target paths, execution host, and flags together before approving a command.',
    takeaway: 'An otherwise familiar command can be unsafe because of an extra operand.',
    lookup: 'Use pwd, ls, and the command manual to check the proposal without running it.',
    review: 'List every target and its effect; stop before any destructive operation.',
  },
  slurm: {
    key: 'scheduler', title: 'Scheduler submissions', definition: 'A scheduler accepts a resource request and starts eligible work on allocated resources.',
    takeaway: 'It schedules a process; it does not carry the application’s data.',
    lookup: 'On a Slurm system consult sbatch --help and man sbatch.', review: 'Explain the resource request, then review the job script.',
  },
}

export function conceptForAward(key: string): string {
  return Object.keys(codex).find(id => (codex[id].key ?? id) === key) ?? key
}
