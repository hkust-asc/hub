import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/practice/engine/game.ts";
import { levels } from "../src/practice/engine/levels/index.ts";
import { xray } from "../src/practice/engine/shell.ts";

function mission(id: number): Game {
  const level = levels.find(item => item.id === id);
  assert.ok(level, `missing mission ${id}`);
  return new Game(undefined, [level]);
}

function submit(game: Game, commands: string[]): void {
  for (const command of commands) {
    const result = game.run(command);
    assert.equal(result.code, 0, `${command}: ${result.stderr}`);
  }
}

test("only a successful workspace reveal before reading the key earns the cards", () => {
  const game = new Game();
  const read = "cat .vault/.access_key";
  assert.doesNotMatch(game.run("ls").stdout, /\.vault/);
  assert.match(game.run(read).feedback.join("\n"), /Reveal.*workspace/);
  assert.equal(game.run(`ls -a .vault | ${read}`).completed, false);
  assert.equal(game.run("ls -a . missing").code, 1);
  assert.equal(game.run(read).completed, false);
  assert.equal(game.run(`${read} | ls -a`).completed, false);
  const result = game.run(read);
  assert.equal(result.stdout, "VAULT-READY\n");
  assert.equal(result.completed, true);
  assert.deepEqual(game.store.state.cards, ["filesystem", "paths", "dotfiles", "help"]);
  assert.equal(game.run(read).completed, false, "replaying must not award the cards twice");
});

test("installing the diagnostic is judged at launch, not at the end of the pipeline", () => {
  for (const [command, completes] of [
    ["./diag.sh | rm ~/downloads/diag.sh", false],
    ["rm ~/downloads/diag.sh | ./diag.sh", true],
  ] as const) {
    const game = mission(2);
    submit(game, ["cp ~/downloads/diag.sh ~/bin", "cd ~/bin", "chmod +x diag.sh"]);
    const result = game.run(command);
    assert.deepEqual(result.stages.map(stage => stage.code), [0, 0]);
    assert.match(result.stages.find(stage => stage.name === "./diag.sh")!.stdout, /Diagnostic passed/);
    assert.equal(game.run("cat ~/downloads/diag.sh").code, 1);
    assert.equal(result.completed, completes);
    if (!completes) {
      assert.match(result.feedback.join("\n"), /still exists at ~\/downloads\/diag\.sh/);
      assert.equal(game.run("./diag.sh").completed, true);
    } else assert.deepEqual(result.feedback, []);
  }
});

test("stream routing and extracting the sensor frequency can be demonstrated in either order", () => {
  const route = "./sensor_dump 2>err.log >./clean.txt";
  const extract = "./sensor_dump 2>/dev/null | grep -i target_freq > found.txt";
  for (const pair of [[route, extract], [extract, route]]) {
    const game = mission(3);
    assert.equal(game.run(pair[0]).completed, false);
    assert.equal(game.run(pair[1]).completed, true);
    assert.equal(game.run("cat clean.txt").stdout, "SENSOR: ONLINE\nTARGET_FREQ: 4.2GHz\nSAMPLES: 16\n");
    assert.equal(game.run("cat err.log").stdout, "WARN: auxiliary probe did not respond\nERROR: backup sensor timed out\n");
    assert.equal(game.run("cat found.txt").stdout, "TARGET_FREQ: 4.2GHz\n");
  }
  const game = mission(3);
  game.run(route);
  assert.equal(game.run('echo "TARGET_FREQ: 4.2GHz" | grep TARGET_FREQ').completed, false);
  assert.equal(game.run("grep TARGET_FREQ clean.txt").completed, true);
});

test("the original agent must report status by name, with its demo environment, outside its install directory", () => {
  const game = mission(4);
  assert.match(game.run("asc-agent --status").stderr, /command not found/);
  assert.match(game.run("~/.local/bin/asc-agent --status").stderr, /missing or invalid/);
  submit(game, ["export AGENT_API_KEY=hkust-demo"]);
  const direct = game.run("~/.local/bin/asc-agent --status");
  assert.match(direct.stdout, /Demo environment verified/);
  assert.match(direct.feedback.join("\n"), /by name/);
  assert.match(direct.feedback.join("\n"), /Add .*PATH/);
  submit(game, ["cd ~/.local/bin"]);
  assert.match(game.run('export PATH="$PATH:$HOME/.local/bin" | asc-agent --status').feedback.join("\n"), /Leave/);
  submit(game, ["cd -", "cp ~/.local/bin/asc-agent /tmp/agent", "mv /tmp/agent ~/.local/bin/asc-agent"]);
  const replacement = game.run("asc-agent --status");
  assert.match(replacement.feedback.join("\n"), /restore the original/);
  assert.equal(replacement.completed, false);
  assert.ok(game.select(4));
  submit(game, ["echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc",
    "echo 'export AGENT_API_KEY=hkust-demo' >> ~/.bashrc", ". ~/.bashrc"]);
  assert.equal(game.run("which asc-agent").stdout, "/home/cadet/.local/bin/asc-agent\n");
  assert.equal(game.run("asc-agent --status").completed, true);
});

test("hardware inspection counts, but the runaway must be identified before it is stopped", () => {
  const game = mission(5);
  submit(game, ["lscpu"]);
  const early = game.run("kill 4821");
  assert.match(early.feedback.join("\n"), /Select Mission 05 again/);
  assert.doesNotMatch(early.stdout, /Select Mission/);
  assert.equal(game.run("ps aux").completed, false);
  assert.match(game.run("kill -9 4821").stderr, /no such process/);
  assert.ok(game.select(5));
  const run = game.run("ps | kill -9 4821");
  assert.equal(run.completed, false, "hardware has not been inspected");
  assert.deepEqual(run.feedback, []);
  assert.match(run.stages[0].stdout, /4821.*stress_matmul/);
  assert.match(run.stdout, /SIGKILL/);
  assert.doesNotMatch(game.run("ps aux").stdout, /4821/);
  assert.equal(game.run("free -h").completed, true);
});

test("unlockAll lets a learner jump directly to later missions without changing completed records", () => {
  const game = new Game();
  assert.equal(game.isUnlocked(4), false);
  assert.equal(game.select(4), false);
  game.setUnlockAll(true);
  assert.equal(game.isUnlocked(4), true);
  assert.equal(game.select(4), true);
  assert.equal(game.level.id, 4);
  assert.equal(game.isComplete(1), false);
  game.setUnlockAll(false);
  assert.equal(game.isUnlocked(4), false);
  assert.equal(game.isUnlocked(1), true);
});

test("audit decisions advance only in order and never dispatch proposal text", () => {
  const audit = levels.find(level => level.id === 6);
  assert.ok(audit?.proposals);
  // Even an approved proposal with a visible side effect must remain just text.
  const game = new Game(undefined, [{ ...audit, proposals: audit.proposals.map(proposal => ({
    ...proposal, command: "echo dispatched >> review",
  })) }]);
  game.run("echo untouched > review");
  for (const [index, expected] of (["reject", "reject", "approve"] as const).entries()) {
    assert.equal(game.decide("later"), null);
    const wrong = game.decide(expected === "approve" ? "reject" : "approve");
    assert.ok(wrong && !wrong.accepted && !wrong.completed && wrong.explanation);
    assert.equal(game.proposalIndex, index);
    const right = game.decide(expected);
    assert.ok(right?.accepted);
    assert.equal(right.completed, index === 2);
  }
  assert.equal(game.proposal, undefined);
  assert.equal(game.decide("approve"), null);
  assert.deepEqual(game.store.state.history, ["echo untouched > review"]);
  assert.equal(game.run("cat review").stdout, "untouched\n");
  assert.equal(game.level.reward?.title, "Level 1 Clearance Certificate");
});

test("the audit highlights the dangerous operands in context without executing them", () => {
  const game = mission(6);
  const danger = () => {
    const proposal = game.proposal;
    assert.ok(proposal);
    return xray(proposal.command, game.shell.cwd, proposal.host).filter(token => token.type === "danger").map(token => token.label);
  };
  assert.deepEqual(danger(), ["-rf", "/"]);
  game.decide("reject");
  assert.deepEqual(danger(), ["./hpl_benchmark", "--threads", "128"]);
  game.decide("reject");
  assert.deepEqual(danger(), []);
  const parts = xray('cat "./my file" | grep -i "item" > out');
  assert.deepEqual(parts.map(token => token.type), ["command", "path", "operator", "command", "flag", "argument", "operator", "path"]);
  assert.equal(parts[0].origin, "concatenate");
  assert.equal(parts[1].label, '"./my file"');
});

test("malformed input cannot apply a valid prefix or earn reveal evidence", () => {
  const game = mission(1);
  for (const input of ["ls -a |", "ls -a >", 'ls -a "open', "ls -a | cat | cat"]) {
    const result = game.run(input);
    assert.equal(result.code, 2, input);
    assert.deepEqual(result.stages, []);
    assert.equal(result.completed, false);
  }
  assert.equal(game.run("cat .vault/.access_key").completed, false);
  assert.equal(game.run("ls -a | cat .vault/.access_key").completed, true);
});

test("a diagnostic that prints success still explains missing permission, location, invocation or content", () => {
  const game = mission(2);
  submit(game, ["mv ~/downloads/diag.sh ~/bin"]);
  assert.match(game.run("~/bin/diag.sh").stderr, /permission denied/);
  const source = game.run("source ~/bin/diag.sh");
  assert.match(source.stdout, /Diagnostic passed/);
  assert.match(source.feedback.join("\n"), /chmod \+x/);
  assert.equal(source.completed, false);
  submit(game, ["chmod +x ~/bin/diag.sh"]);
  const outside = game.run("./../bin/diag.sh");
  assert.equal(outside.completed, false);
  assert.match(outside.feedback.join("\n"), /Change to ~\/bin/);
  submit(game, ["cd ~/bin"]);
  const absolute = game.run("~/bin/diag.sh");
  assert.equal(absolute.completed, false);
  assert.match(absolute.feedback.join("\n"), /Launch the installed script as \.\/diag\.sh/);
  submit(game, [`echo "echo 'Diagnostic passed: simulated node is ready.'" > diag.sh`]);
  const replacement = game.run("./diag.sh");
  assert.match(replacement.stdout, /Diagnostic passed/);
  assert.match(replacement.feedback.join("\n"), /diagnostic script, unchanged/);
  assert.equal(replacement.completed, false);
});

test("reading help does not count as inspecting hardware", () => {
  const game = mission(5);
  const help = game.run("lscpu --help");
  assert.ok(help.stages[0].help);
  submit(game, ["ps aux"]);
  assert.equal(game.run("kill 4821").completed, false);
  assert.equal(game.run("lscpu").completed, true);
});
