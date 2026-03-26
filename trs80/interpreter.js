const KEYWORDS = new Set([
  "CLS",
  "DIM",
  "DIR",
  "END",
  "ELSE",
  "FOR",
  "GOTO",
  "HELP",
  "IF",
  "INPUT",
  "LET",
  "LOAD",
  "LIST",
  "NEW",
  "NEXT",
  "PRINT",
  "REM",
  "RUN",
  "SAVE",
  "STEP",
  "STOP",
  "THEN",
  "TO",
]);

function isWhitespace(char) {
  return /\s/.test(char);
}

function isDigit(char) {
  return /[0-9]/.test(char);
}

function isIdentifierStart(char) {
  return /[A-Za-z]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9$]/.test(char);
}

function normalizeIdentifier(value) {
  return value.toUpperCase();
}

function truthy(value) {
  if (typeof value === "string") {
    return value.length > 0;
  }
  return Number(value) !== 0;
}

function numericValue(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error("TYPE MISMATCH");
  }
  return numeric;
}

function stringifyValue(value) {
  if (typeof value === "number") {
    const stable = Math.abs(value) < 1e-12 ? 0 : value;
    return Number.isInteger(stable) ? String(stable) : String(stable);
  }
  return String(value ?? "");
}

class TokenStream {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  peek() {
    return this.tokens[this.index] ?? null;
  }

  next() {
    const token = this.peek();
    if (token) {
      this.index += 1;
    }
    return token;
  }

  eof() {
    return this.index >= this.tokens.length;
  }

  match(type, value) {
    const token = this.peek();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      return null;
    }
    this.index += 1;
    return token;
  }

  expect(type, value) {
    const token = this.next();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error("SYNTAX ERROR");
    }
    return token;
  }

  rest() {
    return this.tokens.slice(this.index);
  }
}

function tokenize(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (isWhitespace(char)) {
      index += 1;
      continue;
    }

    if (char === '"') {
      let end = index + 1;
      let value = "";
      while (end < source.length && source[end] !== '"') {
        value += source[end];
        end += 1;
      }
      if (end >= source.length) {
        throw new Error("UNTERMINATED STRING");
      }
      tokens.push({ type: "string", value });
      index = end + 1;
      continue;
    }

    if (isDigit(char) || (char === "." && isDigit(source[index + 1] ?? ""))) {
      let end = index + 1;
      while (end < source.length && /[0-9.]/.test(source[end])) {
        end += 1;
      }
      const value = Number(source.slice(index, end));
      if (Number.isNaN(value)) {
        throw new Error("BAD NUMBER");
      }
      tokens.push({ type: "number", value });
      index = end;
      continue;
    }

    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < source.length && isIdentifierPart(source[end])) {
        end += 1;
      }
      const value = normalizeIdentifier(source.slice(index, end));
      tokens.push({
        type: KEYWORDS.has(value) ? "keyword" : "identifier",
        value,
      });
      index = end;
      continue;
    }

    const pair = source.slice(index, index + 2);
    if (["<>", "<=", ">="].includes(pair)) {
      tokens.push({ type: "operator", value: pair });
      index += 2;
      continue;
    }

    if ("+-*/=<>".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if ("(),;:@".includes(char)) {
      tokens.push({ type: "punctuation", value: char });
      index += 1;
      continue;
    }

    throw new Error(`ILLEGAL CHARACTER ${char}`);
  }

  return tokens;
}

function splitStatements(source) {
  const statements = [];
  let current = "";
  let inString = false;

  for (const char of source) {
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }

    if (char === ":" && !inString) {
      statements.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  statements.push(current);
  return statements;
}

function rebuildSource(tokens) {
  return tokens
    .map((token) => token.type === "string" ? `"${token.value}"` : String(token.value))
    .join(" ");
}

function programListing(program) {
  return Array.from(program.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([lineNumber, statement]) => `${lineNumber} ${statement}`);
}

const DISPLAY_COLUMNS = 64;
const DISPLAY_ROWS = 16;
const DISPLAY_MAX_POSITION = DISPLAY_COLUMNS * DISPLAY_ROWS - 1;

const EXECUTION_MODES = {
  slow: {
    scheduler: "timeout",
    delayMs: 100,
    statementsPerTick: 4,
  },
  normal: {
    scheduler: "timeout",
    delayMs: 50,
    statementsPerTick: 8,
  },
  turbo: {
    scheduler: "animationFrame",
    delayMs: 0,
    statementsPerTick: 800,
  },
};

const BASIC_FUNCTIONS = {
  ABS: (value) => Math.abs(value),
  COS: (value) => Math.cos(value),
  EXP: (value) => Math.exp(value),
  INT: (value) => Math.floor(value),
  LOG: (value) => Math.log(value),
  RND: () => Math.random(),
  SGN: (value) => (value < 0 ? -1 : value > 0 ? 1 : 0),
  SIN: (value) => Math.sin(value),
  SQR: (value) => {
    if (value < 0) {
      throw new Error("ILLEGAL FUNCTION CALL");
    }
    return Math.sqrt(value);
  },
  TAN: (value) => Math.tan(value),
};

class BasicRuntime {
  constructor(options = {}) {
    this.output = options.output ?? (() => {});
    this.clearScreen = options.clearScreen ?? (() => {});
    this.saveProgramHandler = options.saveProgram ?? (() => {
      throw new Error("SAVE NOT AVAILABLE");
    });
    this.loadProgramHandler = options.loadProgram ?? (() => null);
    this.listProgramsHandler = options.listPrograms ?? (() => []);
    this.onPauseStateChange = options.onPauseStateChange ?? (() => {});
    this.onReadyStateChange = options.onReadyStateChange ?? (() => {});
    this.onProgramChange = options.onProgramChange ?? (() => {});
    this.onVariablesChange = options.onVariablesChange ?? (() => {});
    this.program = new Map();
    this.variables = Object.create(null);
    this.arrays = Object.create(null);
    this.running = false;
    this.stopRequested = false;
    this.lineNumbers = [];
    this.lineIndex = 0;
    this.statementIndex = 0;
    this.executionCounter = 0;
    this.loopStack = [];
    this.paused = false;
    this.resumeAction = null;
    this.executionMode = Object.hasOwn(EXECUTION_MODES, options.executionMode)
      ? options.executionMode
      : "normal";
    this.onReadyStateChange(true);
  }

  enter(source) {
    const cleaned = source.replace(/\r/g, "");
    if (!cleaned.trim()) {
      return;
    }

    const lineMatch = cleaned.match(/^(\d+)\s*(.*)$/);
    if (lineMatch) {
      const lineNumber = Number(lineMatch[1]);
      const statement = lineMatch[2].trim();

      if (statement) {
        this.program.set(lineNumber, statement);
      } else {
        this.program.delete(lineNumber);
      }

      this.onProgramChange(this.program);
      return;
    }

    this.executeImmediate(cleaned.trim());
  }

  executeImmediate(statement) {
    if (this.running) {
      throw new Error("BUSY");
    }
    this.executeStatements(statement, { allowFlowControl: false });
  }

  executeStatements(source, context = {}) {
    const statements = splitStatements(source);
    let statementIndex = context.currentStatementIndex ?? 0;

    for (; statementIndex < statements.length; statementIndex += 1) {
      context.currentStatementIndex = statementIndex;
      const statement = statements[statementIndex];
      if (!statement.trim()) {
        continue;
      }
      this.executeStatement(statement.trim(), context);
      context.executedStatements = (context.executedStatements ?? 0) + 1;
      if (this.paused || context.jumpRequested || context.stopProgram) {
        return;
      }
    }
  }

  executeStatement(source, context = {}) {
    const upper = source.toUpperCase();

    if (upper === "RUN") {
      if (context.allowFlowControl) {
        throw new Error("ILLEGAL DIRECT");
      }
      this.runProgram();
      return;
    }

    if (upper === "LIST") {
      if (context.allowFlowControl) {
        throw new Error("ILLEGAL DIRECT");
      }
      this.listProgram();
      return;
    }

    if (upper === "DIR") {
      if (context.allowFlowControl) {
        throw new Error("ILLEGAL DIRECT");
      }
      this.listDirectory();
      return;
    }

    if (upper === "NEW") {
      if (context.allowFlowControl) {
        throw new Error("ILLEGAL DIRECT");
      }
        this.program.clear();
        this.variables = Object.create(null);
        this.arrays = Object.create(null);
        this.onProgramChange(this.program);
        this.onVariablesChange(this.variables);
        return;
    }

    if (upper === "HELP") {
      if (context.allowFlowControl) {
        throw new Error("ILLEGAL DIRECT");
      }
      this.emitLines([
        "COMMANDS: RUN LIST DIR SAVE LOAD NEW CLS PRINT LET DIM IF GOTO FOR NEXT END STOP REM",
        "FUNCTIONS: ABS COS EXP INT LOG RND SGN SIN SQR TAN",
        "ENTER PROGRAM LINES WITH NUMBERS, FOR EXAMPLE: 10 PRINT \"HELLO\"",
      ]);
      return;
    }

    if (upper === "CLS") {
      this.clearScreen();
      return;
    }

    const stream = new TokenStream(tokenize(source));
    const first = stream.peek();
    if (!first) {
      return;
    }

    if (first.type === "keyword") {
      switch (first.value) {
        case "PRINT":
          stream.next();
          this.handlePrint(stream);
          return;
        case "SAVE":
          stream.next();
          this.handleSave(stream, context);
          return;
        case "LOAD":
          stream.next();
          this.handleLoad(stream, context);
          return;
        case "LET":
          stream.next();
          this.handleAssignment(stream);
          return;
        case "DIM":
          stream.next();
          this.handleDim(stream);
          return;
        case "GOTO":
          stream.next();
          this.handleGoto(stream, context);
          return;
        case "FOR":
          stream.next();
          this.handleFor(stream, context);
          return;
        case "IF":
          stream.next();
          this.handleIf(stream, context);
          return;
        case "NEXT":
          stream.next();
          this.handleNext(stream, context);
          return;
        case "END":
        case "STOP":
          if (!context.allowFlowControl) {
            throw new Error("CAN'T STOP");
          }
          context.stopProgram = true;
          this.running = false;
          return;
        case "REM":
          return;
        case "INPUT":
          throw new Error("INPUT NOT SUPPORTED");
        default:
          throw new Error("WHAT?");
      }
    }

    if (first.type === "identifier") {
      this.handleAssignment(stream);
      return;
    }

    throw new Error("SYNTAX ERROR");
  }

  handlePrint(stream) {
    let outputOptions = {};

    if (stream.match("punctuation", "@")) {
      const positionValue = numericValue(this.parseExpression(stream));
      if (!Number.isInteger(positionValue) || positionValue < 0 || positionValue > DISPLAY_MAX_POSITION) {
        throw new Error("BAD POSITION");
      }

      outputOptions = { position: positionValue };

      if (!stream.eof()) {
        const separatorAfterPosition = stream.match("punctuation", ",") ?? stream.match("punctuation", ";");
        if (!separatorAfterPosition) {
          throw new Error("SYNTAX ERROR");
        }
      }
    }

    if (stream.eof()) {
      this.output("", "default", outputOptions);
      return;
    }

    let text = "";
    let trailingSeparator = false;

    while (!stream.eof()) {
      const value = this.parseExpression(stream);
      text += stringifyValue(value);

      const separator = stream.match("punctuation", ";") ?? stream.match("punctuation", ",");
      if (!separator) {
        trailingSeparator = false;
        break;
      }

      trailingSeparator = true;
      if (separator.value === ",") {
        text += "    ";
      }
    }

    if (!stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }

    this.output(text, "default", {
      ...outputOptions,
      suppressNewline: trailingSeparator,
    });
  }

  handleAssignment(stream) {
    const identifier = stream.expect("identifier").value;
    let arrayIndex = null;
    if (stream.match("punctuation", "(")) {
      arrayIndex = this.parseArrayIndex(stream);
      stream.expect("punctuation", ")");
    }
    stream.expect("operator", "=");
    const value = this.parseExpression(stream);

    if (!stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }

    if (arrayIndex !== null) {
      this.setArrayValue(identifier, arrayIndex, value);
    } else {
      this.variables[identifier] = value;
    }
    this.onVariablesChange(this.variables);
  }

  handleSave(stream, context) {
    if (context.allowFlowControl) {
      throw new Error("ILLEGAL DIRECT");
    }

    const programName = this.parseProgramName(stream);
    this.saveProgramHandler(programName, programListing(this.program));
    this.output(`SAVED ${programName}`);
  }

  handleLoad(stream, context) {
    if (context.allowFlowControl) {
      throw new Error("ILLEGAL DIRECT");
    }

    const programName = this.parseProgramName(stream);
    const programLines = this.loadProgramHandler(programName);
    if (!programLines) {
      throw new Error("FILE NOT FOUND");
    }

    this.program.clear();
    for (const [lineNumber, statement] of programLines) {
      this.program.set(lineNumber, statement);
    }
    this.variables = Object.create(null);
    this.arrays = Object.create(null);
    this.loopStack = [];
    this.onProgramChange(this.program);
    this.onVariablesChange(this.variables);
    this.output(`LOADED ${programName}`);
  }

  parseProgramName(stream) {
    const token = stream.next();
    if (!token) {
      throw new Error("SYNTAX ERROR");
    }

    let programName;
    if (token.type === "string") {
      programName = token.value.trim();
    } else if (token.type === "identifier") {
      programName = token.value.trim();
    } else {
      throw new Error("SYNTAX ERROR");
    }

    if (!programName || !stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }

    return programName.toUpperCase();
  }

  listDirectory() {
    const names = this.listProgramsHandler()
      .map((name) => String(name).trim().toUpperCase())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    if (names.length === 0) {
      this.output("NO PROGRAMS");
      return;
    }

    this.emitLines(names);
  }

  handleDim(stream) {
    let declared = false;

    while (true) {
      const identifier = stream.expect("identifier").value;
      stream.expect("punctuation", "(");
      const size = this.parseArrayIndex(stream);
      stream.expect("punctuation", ")");

      this.arrays[identifier] = {
        size,
        values: Array(size + 1).fill(identifier.endsWith("$") ? "" : 0),
      };
      declared = true;

      if (!stream.match("punctuation", ",")) {
        break;
      }
    }

    if (!declared || !stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }
  }

  handleGoto(stream, context) {
    if (!context.allowFlowControl) {
      throw new Error("ILLEGAL DIRECT");
    }

    const target = stream.expect("number").value;
    if (!Number.isInteger(target)) {
      throw new Error("BAD LINE NUMBER");
    }
    if (!stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }

    const index = this.lineNumbers.indexOf(target);
    if (index < 0) {
      throw new Error("UNDEFINED LINE");
    }

    this.lineIndex = index;
    this.statementIndex = 0;
    context.jumpRequested = true;
  }

  handleFor(stream, context) {
    if (!context.allowFlowControl) {
      throw new Error("ILLEGAL DIRECT");
    }

    const variable = stream.expect("identifier").value;
    stream.expect("operator", "=");

    const start = numericValue(this.parseExpression(stream));
    stream.expect("keyword", "TO");
    const limit = numericValue(this.parseExpression(stream));

    let step = 1;
    if (stream.match("keyword", "STEP")) {
      step = numericValue(this.parseExpression(stream));
    }

    if (!stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }

    if (step === 0) {
      throw new Error("BAD STEP");
    }

    this.variables[variable] = start;
    this.onVariablesChange(this.variables);

    if (!loopShouldContinue(start, limit, step)) {
      const nextTarget = this.findMatchingNext(context.currentLineIndex, context.currentStatementIndex);
      if (!nextTarget) {
        throw new Error("FOR WITHOUT NEXT");
      }

      this.lineIndex = nextTarget.lineIndex;
      this.statementIndex = nextTarget.statementIndex;
      context.jumpRequested = true;
      return;
    }

    this.loopStack.push({
      variable,
      limit,
      step,
      lineIndex: context.currentLineIndex,
      statementIndex: context.currentStatementIndex + 1,
    });
  }

  handleIf(stream, context) {
    const condition = this.parseCondition(stream);
    stream.expect("keyword", "THEN");

    const remaining = stream.rest();
    if (remaining.length === 0) {
      throw new Error("SYNTAX ERROR");
    }

    const elseIndex = remaining.findIndex((token) => token.type === "keyword" && token.value === "ELSE");
    const thenTokens = elseIndex >= 0 ? remaining.slice(0, elseIndex) : remaining;
    const elseTokens = elseIndex >= 0 ? remaining.slice(elseIndex + 1) : [];

    if (thenTokens.length === 0 || (elseIndex >= 0 && elseTokens.length === 0)) {
      throw new Error("SYNTAX ERROR");
    }

    this.executeIfBranch(condition ? thenTokens : elseTokens, context);
  }

  executeIfBranch(tokens, context) {
    if (tokens.length === 0) {
      return;
    }

    if (tokens.length === 1 && tokens[0].type === "number") {
      const gotoStream = new TokenStream(tokens);
      this.handleGoto(gotoStream, context);
      return;
    }

    this.executeStatements(rebuildSource(tokens), context);
  }

  handleNext(stream, context) {
    if (!context.allowFlowControl) {
      throw new Error("ILLEGAL DIRECT");
    }

    const variable = stream.match("identifier")?.value ?? null;
    if (!stream.eof()) {
      throw new Error("SYNTAX ERROR");
    }

    const loopEntry = this.loopStack.at(-1);
    if (!loopEntry) {
      throw new Error("NEXT WITHOUT FOR");
    }

    if (variable && loopEntry.variable !== variable) {
      throw new Error("NEXT WITHOUT FOR");
    }

    const nextValue = numericValue(this.variables[loopEntry.variable] ?? 0) + loopEntry.step;
    this.variables[loopEntry.variable] = nextValue;
    this.onVariablesChange(this.variables);

    if (loopShouldContinue(nextValue, loopEntry.limit, loopEntry.step)) {
      this.lineIndex = loopEntry.lineIndex;
      this.statementIndex = loopEntry.statementIndex;
      context.jumpRequested = true;
      return;
    }

    this.loopStack.pop();
  }

  parseCondition(stream) {
    const left = this.parseExpression(stream);
    const operator = stream.match("operator", "=")
      ?? stream.match("operator", "<>")
      ?? stream.match("operator", "<=")
      ?? stream.match("operator", ">=")
      ?? stream.match("operator", "<")
      ?? stream.match("operator", ">");

    if (!operator) {
      return truthy(left);
    }

    const right = this.parseExpression(stream);
    switch (operator.value) {
      case "=":
        return left === right;
      case "<>":
        return left !== right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      default:
        throw new Error("SYNTAX ERROR");
    }
  }

  parseExpression(stream) {
    return this.parseAdditive(stream);
  }

  parseAdditive(stream) {
    let value = this.parseMultiplicative(stream);

    while (true) {
      const operator = stream.match("operator", "+") ?? stream.match("operator", "-");
      if (!operator) {
        return value;
      }

      const right = this.parseMultiplicative(stream);
      if (operator.value === "+") {
        value = typeof value === "string" || typeof right === "string"
          ? `${stringifyValue(value)}${stringifyValue(right)}`
          : numericValue(value) + numericValue(right);
      } else {
        value = numericValue(value) - numericValue(right);
      }
    }
  }

  parseMultiplicative(stream) {
    let value = this.parseUnary(stream);

    while (true) {
      const operator = stream.match("operator", "*") ?? stream.match("operator", "/");
      if (!operator) {
        return value;
      }

      const right = this.parseUnary(stream);
      if (operator.value === "*") {
        value = numericValue(value) * numericValue(right);
      } else {
        value = numericValue(value) / numericValue(right);
      }
    }
  }

  parseUnary(stream) {
    if (stream.match("operator", "+")) {
      return numericValue(this.parseUnary(stream));
    }

    if (stream.match("operator", "-")) {
      return -numericValue(this.parseUnary(stream));
    }

    const token = stream.next();
    if (!token) {
      throw new Error("SYNTAX ERROR");
    }

    if (token.type === "number" || token.type === "string") {
      return token.value;
    }

    if (token.type === "identifier") {
      if (stream.match("punctuation", "(")) {
        const argument = this.parseExpression(stream);
        stream.expect("punctuation", ")");

        if (this.arrays[token.value]) {
          return this.getArrayValue(token.value, argument);
        }

        return this.evaluateFunction(token.value, numericValue(argument));
      }

      return this.variables[token.value] ?? (token.value.endsWith("$") ? "" : 0);
    }

    if (token.type === "punctuation" && token.value === "(") {
      const value = this.parseExpression(stream);
      stream.expect("punctuation", ")");
      return value;
    }

    throw new Error("SYNTAX ERROR");
  }

  evaluateFunction(name, argument) {
    const fn = BASIC_FUNCTIONS[name];
    if (!fn) {
      throw new Error("UNDEFINED FUNCTION");
    }

    const result = fn(argument);
    if (!Number.isFinite(result)) {
      throw new Error("ILLEGAL FUNCTION CALL");
    }
    return result;
  }

  parseArrayIndex(stream) {
    const index = numericValue(this.parseExpression(stream));
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("BAD SUBSCRIPT");
    }
    return index;
  }

  getArrayValue(name, indexValue) {
    const arrayRef = this.arrays[name];
    if (!arrayRef) {
      throw new Error("UNDEFINED ARRAY");
    }

    const index = Number(indexValue);
    if (!Number.isInteger(index) || index < 0 || index > arrayRef.size) {
      throw new Error("BAD SUBSCRIPT");
    }

    return arrayRef.values[index];
  }

  setArrayValue(name, index, value) {
    const arrayRef = this.arrays[name];
    if (!arrayRef) {
      throw new Error("UNDEFINED ARRAY");
    }

    if (index < 0 || index > arrayRef.size) {
      throw new Error("BAD SUBSCRIPT");
    }

    arrayRef.values[index] = value;
  }

  listProgram() {
    const listing = programListing(this.program);
    if (listing.length === 0) {
      this.output("NO PROGRAM");
      return;
    }

    this.emitLines(listing);
  }

  loadProgram(lines) {
    this.stop();
    this.program.clear();
    for (const [lineNumber, statement] of lines) {
      this.program.set(lineNumber, statement);
    }
    this.variables = Object.create(null);
    this.arrays = Object.create(null);
    this.loopStack = [];
    this.onProgramChange(this.program);
    this.onVariablesChange(this.variables);
  }

  runProgram() {
    if (this.running) {
      throw new Error("BUSY");
    }

    this.lineNumbers = Array.from(this.program.keys()).sort((left, right) => left - right);
    if (this.lineNumbers.length === 0) {
      this.output("NO PROGRAM");
      return;
    }

    this.variables = Object.create(null);
    this.arrays = Object.create(null);
    this.onVariablesChange(this.variables);
    this.running = true;
    this.stopRequested = false;
    this.executionCounter = 0;
    this.lineIndex = 0;
    this.statementIndex = 0;
    this.loopStack = [];
    this.onReadyStateChange(false);
    this.schedule();
  }

  schedule() {
    const profile = EXECUTION_MODES[this.executionMode] ?? EXECUTION_MODES.normal;
    if (profile.scheduler === "animationFrame" && typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => this.executeRunSlice());
      return;
    }

    setTimeout(() => this.executeRunSlice(), profile.delayMs);
  }

  executeRunSlice() {
    try {
      const profile = EXECUTION_MODES[this.executionMode] ?? EXECUTION_MODES.normal;
      let steps = 0;
      while (this.running && !this.stopRequested && steps < profile.statementsPerTick) {
        if (this.lineIndex >= this.lineNumbers.length) {
          this.finishRun();
          return;
        }

        const currentLine = this.lineNumbers[this.lineIndex];
        const statement = this.program.get(currentLine);
        const context = {
          allowFlowControl: true,
          currentLine,
          currentLineIndex: this.lineIndex,
          currentStatementIndex: this.statementIndex,
        };
        this.lineIndex += 1;
        this.statementIndex = 0;
        this.executeStatements(statement, context);
        const executedStatements = context.executedStatements ?? 0;
        this.executionCounter += executedStatements;
        steps += Math.max(executedStatements, 1);

        if (this.paused) {
          return;
        }

        if (!this.running || context.stopProgram) {
          this.finishRun();
          return;
        }
      }

      if (this.stopRequested) {
        this.output("BREAK", "warning");
        this.finishRun();
        return;
      }

      if (this.running) {
        this.schedule();
      }
    } catch (error) {
      const lineNumber = this.lineNumbers[Math.max(this.lineIndex - 1, 0)];
      const suffix = lineNumber ? ` IN ${lineNumber}` : "";
      this.output(`${error.message}${suffix}`, "error");
      this.finishRun();
    }
  }

  stop() {
    if (this.paused && this.running) {
      this.paused = false;
      this.resumeAction = null;
      this.onPauseStateChange(false);
      this.output("BREAK", "warning");
      this.finishRun();
      return;
    }

    if (this.paused) {
      this.paused = false;
      this.resumeAction = null;
      this.onPauseStateChange(false);
    }

    if (this.running) {
      this.stopRequested = true;
    }
  }

  finishRun() {
    this.running = false;
    this.stopRequested = false;
    this.statementIndex = 0;
    this.loopStack = [];
    this.paused = false;
    this.resumeAction = null;
    this.onPauseStateChange(false);
    this.onReadyStateChange(true);
  }

  emitLines(lines, startIndex = 0) {
    for (let index = startIndex; index < lines.length; index += 1) {
      this.output(lines[index]);
      if (this.paused) {
        this.resumeAction = () => this.emitLines(lines, index + 1);
        return;
      }
    }
  }

  pause() {
    if (this.paused) {
      return;
    }

    this.paused = true;
    this.onPauseStateChange(true);
  }

  resume() {
    if (!this.paused) {
      return;
    }

    const continuation = this.resumeAction;
    this.paused = false;
    this.resumeAction = null;
    this.onPauseStateChange(false);

    if (continuation) {
      continuation();
      return;
    }

    if (this.running) {
      this.schedule();
    }
  }

  setExecutionMode(mode) {
    if (!Object.hasOwn(EXECUTION_MODES, mode)) {
      throw new Error("BAD SPEED");
    }

    this.executionMode = mode;
  }

  findMatchingNext(startLineIndex, startStatementIndex) {
    let depth = 0;

    for (let lineIndex = startLineIndex; lineIndex < this.lineNumbers.length; lineIndex += 1) {
      const lineNumber = this.lineNumbers[lineIndex];
      const statements = splitStatements(this.program.get(lineNumber));
      const initialStatementIndex = lineIndex === startLineIndex ? startStatementIndex + 1 : 0;

      for (let statementIndex = initialStatementIndex; statementIndex < statements.length; statementIndex += 1) {
        const statement = statements[statementIndex].trim();
        if (!statement) {
          continue;
        }

        const firstToken = tokenize(statement)[0];
        if (!firstToken || firstToken.type !== "keyword") {
          continue;
        }

        if (firstToken.value === "FOR") {
          depth += 1;
          continue;
        }

        if (firstToken.value !== "NEXT") {
          continue;
        }

        if (depth === 0) {
          if (statementIndex + 1 < statements.length) {
            return { lineIndex, statementIndex: statementIndex + 1 };
          }
          return { lineIndex: lineIndex + 1, statementIndex: 0 };
        }

        depth -= 1;
      }
    }

    return null;
  }
}

function loopShouldContinue(value, limit, step) {
  return step >= 0 ? value <= limit : value >= limit;
}

export { BasicRuntime };
