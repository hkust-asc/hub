import assert from "node:assert/strict";
import test from "node:test";
import { tokenize } from "../src/practice/engine/parser.ts";
import { builtinNames, Shell } from "../src/practice/engine/shell.ts";

test("the display can label quoted words and adjacent redirects, even mid-edit", () => {
  const input = 'echo "hello cadet">greeting 2>err';
  assert.deepEqual(tokenize(input).map(({ type, value, start, end }) => [type, value, input.slice(start, end)]), [
    ["word", "echo", "echo"], ["word", "hello cadet", '"hello cadet"'],
    ["operator", ">", ">"], ["word", "greeting", "greeting"],
    ["operator", "2>", "2>"], ["word", "err", "err"],
  ]);
  assert.equal(tokenize('echo "hello', { partial: true }).at(-1)?.value, "hello");
  assert.throws(() => tokenize('echo "hello'), /unclosed quote/);
});

test("each stage shows the file after opening its redirect but before running its command", () => {
  for (const [command, modeAfterRedirect] of [["chmod +x note", 0o755], ["rm note", 0o644]] as const) {
    const shell = new Shell();
    assert.equal(shell.run("echo original > note").code, 0);
    const result = shell.run(`${command} | echo replacement > note`);
    assert.deepEqual(result.stages.map(stage => stage.code), [0, 0]);
    const [before, after] = result.stages.map(stage => stage.vfsAtExecution?.get("/home/cadet/workspace/note"));
    assert.ok(before?.type === "file" && after?.type === "file");
    assert.deepEqual([before.text, before.mode], ["original\n", 0o644]);
    assert.deepEqual([after.text, after.mode], ["", modeAfterRedirect]);
    assert.ok(Object.isFrozen(before) && Object.isFrozen(after));
    assert.equal(shell.run("cat note").stdout, "replacement\n");
  }
});

test("files, filters and pipes compose without touching the host filesystem", () => {
  const shell = new Shell();
  for (const command of ["mkdir -p a/b", "touch a/b/empty", "echo hello > a/b/note",
    "echo again >> a/b/note", "cp a/b/note a/copy", "mv a/copy a/renamed", "chmod 755 a/renamed"]) {
    assert.equal(shell.run(command).code, 0, command);
  }
  assert.equal(shell.run("head a/renamed").stdout, "hello\nagain\n");
  assert.equal(shell.run("tail a/renamed").stdout, "hello\nagain\n");
  assert.equal(shell.run('grep -iv "HELLO" a/renamed | wc -l').stdout, "1\n");
  assert.equal(shell.run('echo "π 🧪" | wc').stdout, "1 2 8\n");
  const redirected = shell.run("cat missing 2> a/error");
  assert.equal(redirected.code, 1);
  assert.equal(redirected.stderr, "");
  assert.match(shell.run("cat a/error").stdout, /not a file/);
  assert.ok(shell.run("clear").clear);
  assert.equal(shell.run("rm -rf a").code, 0);
  assert.equal(shell.run("cat a/error").code, 1);
});

test("builtins and mission programs explain themselves via --help, man and tldr", () => {
  const shell = new Shell();
  const programs = ["diag.sh", "sensor_dump", "asc-agent"];
  shell.run(`touch ${programs.join(" ")}`);
  shell.run(`chmod +x ${programs.join(" ")}`);
  for (const name of [...builtinNames, ...programs]) {
    for (const command of [`man ${name}`, `tldr ${name}`, `${programs.includes(name) ? "./" : ""}${name} --help`]) {
      const result = shell.run(command);
      assert.equal(result.code, 0, `${command}: ${result.stderr}`);
      assert.ok(result.stdout.includes(name), command);
    }
  }
  assert.match(shell.run("unknown-command --help").stderr, /command not found/);
  assert.match(shell.run("man unknown-command").stderr, /no help entry/);
});

test("variable expansion respects quote and escape boundaries", () => {
  const shell = new Shell();
  for (const [name, value] of [["HOME", "/home/cadet"], ["USER", "cadet"], ["PATH", "/usr/bin:/bin"]]) {
    for (const suffix of ["suffix", "_lab", "7", "a7"]) {
      for (const word of [`"$${name}"${suffix}`, `$${name}"${suffix}"`, `$${name}'${suffix}'`, `$${name}\\${suffix}`]) {
        assert.equal(shell.run(`echo ${word}`).stdout, `${value}${suffix}\n`, word);
      }
    }
  }
  assert.equal(shell.run("echo '$HOME'").stdout, "$HOME\n");
});

test("a root operand anywhere in rm rejects the entire request", () => {
  const shell = new Shell();
  shell.run("echo keep > local");
  for (const flags of ["-rf", "-fr", "-r -f"]) {
    for (const operands of ["local /", "/ local", "local /tmp/.."]) {
      assert.equal(shell.run(`rm ${flags} ${operands}`).code, 1);
      assert.equal(shell.run("cat local").stdout, "keep\n");
    }
  }
});

test("a redirect stays attached to an opened file across a move; copies have independent modes", () => {
  const shell = new Shell();
  shell.run("echo original > old");
  shell.run("cp old copy");
  shell.run("chmod +x copy");
  assert.equal(shell.run("ls -l old").stdout, "-rw-r--r--  old\n");
  assert.equal(shell.run("ls -l copy").stdout, "-rwxr-xr-x  copy\n");
  const result = shell.run("mv old new > old");
  assert.equal(result.code, 0);
  assert.equal(shell.run("cat old").code, 1);
  assert.equal(shell.run("cat new").stdout, "");
  assert.equal(shell.run("cat copy").stdout, "original\n");
});

test("navigation and completion follow the virtual working directory and PATH", () => {
  const shell = new Shell();
  assert.match(shell.run("cd -").stderr, /no previous directory/);
  shell.run("cd /");
  shell.run("cd ..");
  assert.equal(shell.run("pwd").stdout, "/\n");
  shell.run("cd ~");
  assert.equal(shell.prompt, "cadet@asc-node:~$ ");
  assert.equal(shell.run("cd -").stdout, "/\n");
  shell.run("cd ~/workspace");
  shell.run("touch .secret");
  assert.ok(!shell.complete("", false).includes(".secret"));
  shell.run("ls -a");
  assert.ok(shell.complete("", false).includes(".secret"));
  assert.ok(shell.complete("../", false).includes("../workspace/"));
  assert.ok(shell.complete("ls", true).includes("ls"));
  shell.run("touch ~/bin/lab-tool");
  shell.run("export PATH=$PATH:$HOME/bin");
  assert.deepEqual(shell.complete("lab-", true), []);
  shell.run("chmod +x ~/bin/lab-tool");
  assert.deepEqual(shell.complete("lab-", true), ["lab-tool"]);
});
