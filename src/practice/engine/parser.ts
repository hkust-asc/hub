export type RedirectOperator = ">" | ">>" | "2>";
export type Operator = "|" | RedirectOperator;
export interface Segment { text: string; expand: boolean }

interface Span { start: number; end: number }
export interface WordToken extends Span { type: "word"; value: string; segments: Segment[] }
export interface OperatorToken extends Span { type: "operator"; value: Operator }
export type Token = WordToken | OperatorToken;

const operators: readonly Operator[] = ["2>", ">>", "|", ">"];

export function tokenize(input: string, { partial = false } = {}): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    if (/\s/.test(input[index])) {
      index++;
      continue;
    }
    const start = index;
    const op = operators.find(value => input.startsWith(value, index));
    if (op) {
      index += op.length;
      tokens.push({ type: "operator", value: op, start, end: index });
      continue;
    }
    const segments: Segment[] = [];
    let quote = "";
    let segment: Segment | undefined;
    while (index < input.length) {
      const char = input[index];
      if (!quote && /[\s|>]/.test(char)) break;
      index++;
      if (char === "\\" && quote !== "'" && index < input.length) {
        segments.push({ text: input[index++], expand: false });
        segment = undefined;
      } else if (char === quote) {
        quote = "";
        segment = undefined;
      } else if (!quote && (char === '"' || char === "'")) {
        quote = char;
        segment = undefined;
      } else {
        if (!segment) {
          segment = { text: "", expand: quote !== "'" };
          segments.push(segment);
        }
        segment.text += char;
      }
    }
    if (quote && !partial) throw new Error("unclosed quote");
    tokens.push({ type: "word", value: segments.map(part => part.text).join(""), segments, start, end: index });
  }
  return tokens;
}

export function expandWord(token: WordToken, env: Readonly<Record<string, string>>): string {
  return token.segments.map(({ text, expand }) => expand
    ? text.replace(/\$\{([a-z_]\w*)\}|\$([a-z_]\w*)/gi, (_match, braced: string | undefined, bare: string) => {
      const name = braced ?? bare;
      return Object.hasOwn(env, name) ? env[name] : "";
    })
    : text).join("");
}

export function parseFlags(args: readonly string[]): { flags: Set<string>; operands: string[] } {
  const flags = new Set<string>();
  const operands: string[] = [];
  let options = true;
  for (const arg of args) {
    if (options && arg === "--") options = false;
    else if (options && arg.startsWith("--")) flags.add(arg.slice(2));
    else if (options && /^-[a-z\d]+$/i.test(arg)) for (const flag of arg.slice(1)) flags.add(flag);
    else operands.push(arg);
  }
  return { flags, operands };
}

export interface Stage {
  words: WordToken[];
  redirects: { operator: RedirectOperator; target: WordToken }[];
}

export function parse(input: string): Stage[] {
  const tokens = tokenize(input);
  if (!tokens.length) return [];
  let stage: Stage = { words: [], redirects: [] };
  const stages = [stage];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === "word") stage.words.push(token);
    else if (token.value === "|") {
      if (stages.length === 2) throw new Error("only one pipe is supported");
      stage = { words: [], redirects: [] };
      stages.push(stage);
    } else {
      const target = tokens[++index];
      if (target?.type !== "word") throw new Error(`${token.value}: missing redirection target`);
      stage.redirects.push({ operator: token.value, target });
    }
  }
  if (stages.some(part => !part.words.length)) throw new Error("missing command");
  return stages;
}
