import assert from "node:assert/strict";
import test from "node:test";
import { Game, type Decision } from "../src/practice/engine/game.ts";
import type { Verdict } from "../src/practice/engine/levels/index.ts";

type Step = [number, string, string, string, string[], boolean] | [6, Verdict, Decision];

function replay(flags: string, install: "mv" | "cp"): Step[] {
  const game = new Game();
  const transcript: Step[] = [];
  const enter = (command: string, completes = false) => {
    const result = game.run(command);
    assert.equal(result.code, 0, `${command}: ${result.stderr}`);
    assert.equal(result.completed, completes, command);
    transcript.push([game.level.id, command, result.stdout, result.stderr, result.feedback, result.completed]);
    return result;
  };
  const next = (id: number) => assert.ok(game.select(id), `unlock mission ${id}`);

  assert.equal(game.select(2), false);
  assert.match(enter("cat .vault/.access_key").feedback.join("\n"), /Reveal.*workspace/);
  assert.match(enter("ls --help").stdout, /ls/);
  assert.match(enter("tldr ls").stdout, /ls/);
  assert.deepEqual(game.shell.complete(".va", false), [".vault/"]);
  assert.match(enter(`ls ${flags}`).stdout, /\.vault/);
  if (flags === "-la") {
    enter("cd .vault");
    enter("cat .access_key", true);
  } else enter("cat .vault/.access_key", true);
  next(2);
  enter(`${install} ~/downloads/diag.sh ~/bin`);
  enter("cd ~/bin");
  enter(flags === "-a -l" ? "chmod 755 diag.sh" : "chmod +x diag.sh");
  if (install === "cp") {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = enter("./diag.sh");
      assert.match(result.stdout, /Diagnostic passed/);
      assert.match(result.feedback.join("\n"), /still exists at ~\/downloads\/diag\.sh/);
    }
    enter("rm ~/downloads/diag.sh");
  }
  enter("./diag.sh", true);
  next(3);
  enter("./sensor_dump > clean.txt 2> err.log");
  enter("grep TARGET_FREQ clean.txt", true);
  next(4);
  enter('export PATH="$PATH:$HOME"/.local/bin');
  enter('export AGENT_API_KEY="hkust"-demo');
  enter("cd ~/.local/bin");
  assert.match(enter("asc-agent --status").feedback.join("\n"), /Leave ~\/\.local\/bin/);
  enter("cd -");
  enter("asc-agent --status", true);
  next(5);
  enter("lscpu");
  assert.match(enter("kill 4821").feedback.join("\n"), /Select Mission 05 again/);
  next(5);
  enter("lscpu");
  enter("ps aux");
  enter("kill 4821", true);
  next(6);
  enter("echo keep > /tmp/keep");
  for (const [verdict, accepted, completed] of [
    ["approve", false, false], ["reject", true, false],
    ["approve", false, false], ["reject", true, false],
    ["reject", false, false], ["approve", true, true],
  ] as const) {
    const decision = game.decide(verdict);
    assert.ok(decision);
    assert.equal(decision.accepted, accepted);
    assert.equal(decision.completed, completed);
    transcript.push([6, verdict, decision]);
  }
  assert.deepEqual(game.store.state.completed, [1, 2, 3, 4, 5, 6]);
  assert.equal(enter("cat /tmp/keep").stdout, "keep\n");
  assert.equal(game.level.reward?.title, "Level 1 Clearance Certificate");
  game.reset();
  assert.equal(game.shell.cwd, "/home/cadet/workspace");
  assert.equal(game.level.id, 1);
  assert.equal(game.isUnlocked(2), false);
  assert.deepEqual(game.store.state, { completed: [], cards: [], history: [] });
  return transcript;
}

for (const [flags, install] of [["-al", "mv"], ["-la", "cp"], ["-a -l", "mv"]] as const) {
  test(`deterministic full Practice replay: ls ${flags}, ${install} install`, () => {
    assert.deepEqual(replay(flags, install), replay(flags, install));
  });
}
