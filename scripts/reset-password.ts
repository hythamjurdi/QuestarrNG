import { createInterface, type Interface } from "readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { storage } from "../server/storage.js";
import { hashPassword } from "../server/auth.js";
import { logger } from "../server/logger.js";
import { passwordPolicySchema } from "../shared/schema.js";

const ENTER_CODES = new Set([10, 13]);
const CTRL_D_CODE = 4;
const CTRL_C_CODE = 3;
const BACKSPACE_CODES = new Set([8, 127]);

class ExitSignal extends Error {
  constructor(public readonly code: number) {
    super("exit");
  }
}

// Buffered line reader for non-interactive (piped/redirected) stdin. A chunk
// on the pipe can contain multiple lines that readline emits synchronously,
// before the `await` continuation for the next prompt attaches a listener —
// so lines are queued up front rather than read reactively per-prompt.
const lineQueue: string[] = [];
const lineWaiters: Array<{ resolve: (line: string) => void; reject: (err: Error) => void }> = [];
let nonTtyReader: Interface | null = null;
let nonTtyClosed = false;

function readNonTtyLine(): Promise<string> {
  if (!nonTtyReader) {
    nonTtyReader = createInterface({ input: process.stdin });
    nonTtyReader.on("line", (line) => {
      const waiter = lineWaiters.shift();
      if (waiter) {
        waiter.resolve(line);
      } else {
        lineQueue.push(line);
      }
    });
    nonTtyReader.on("close", () => {
      nonTtyClosed = true;
      while (lineWaiters.length > 0) {
        lineWaiters.shift()?.reject(new Error("stdin closed before input was provided"));
      }
    });
  }

  const queued = lineQueue.shift();
  if (queued !== undefined) {
    return Promise.resolve(queued);
  }
  if (nonTtyClosed) {
    return Promise.reject(new Error("stdin closed before input was provided"));
  }
  return new Promise((resolve, reject) => lineWaiters.push({ resolve, reject }));
}

function promptHiddenPassword(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdout.write(question);

    if (!process.stdin.isTTY) {
      // Non-interactive stdin (piped/redirected): fall back to a plain read,
      // since there's no TTY to suppress echo on.
      readNonTtyLine().then(resolve, reject);
      return;
    }

    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    let password = "";
    const onData = (chunk: string) => {
      // A single chunk can contain more than one character (fast typing or a
      // paste), so every code point must be inspected in order rather than
      // just the first one.
      for (const char of chunk) {
        const code = char.codePointAt(0) ?? 0;

        if (ENTER_CODES.has(code) || code === CTRL_D_CODE) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
          return;
        }

        if (code === CTRL_C_CODE) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          reject(new ExitSignal(1));
          return;
        }

        if (BACKSPACE_CODES.has(code)) {
          password = password.slice(0, -1);
          continue;
        }

        password += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  process.exitCode = await runPasswordReset(process.argv.slice(2));
}

export type PasswordResetDependencies = {
  findUserByUsername: (username: string) => Promise<{ id: string } | undefined>;
  updatePasswordHash: (userId: string, passwordHash: string) => Promise<unknown>;
  hashPassword: (password: string) => Promise<string>;
  promptPassword: (question: string) => Promise<string>;
  logger: {
    error: (message: string) => void;
    info: (message: string) => void;
  };
};

const defaultDependencies: PasswordResetDependencies = {
  findUserByUsername: (username) => storage.getUserByUsername(username),
  updatePasswordHash: (userId, passwordHash) => storage.updateUserPassword(userId, passwordHash),
  hashPassword,
  promptPassword: promptHiddenPassword,
  logger,
};

export async function runPasswordReset(
  args: string[],
  dependencies: PasswordResetDependencies = defaultDependencies
): Promise<number> {
  const [username, ...extraArgs] = args;
  if (!username || extraArgs.length > 0) {
    dependencies.logger.error("Usage: npm run reset-password -- <username>");
    return 1;
  }

  try {
    const user = await dependencies.findUserByUsername(username);
    if (!user) {
      dependencies.logger.error(`No user found with username "${username}"`);
      return 1;
    }

    const rawPassword = await dependencies.promptPassword("New password: ");
    const rawConfirmation = await dependencies.promptPassword("Confirm password: ");
    const parsedPassword = passwordPolicySchema.safeParse(rawPassword);
    if (!parsedPassword.success) {
      dependencies.logger.error(parsedPassword.error.issues[0]?.message ?? "Invalid password");
      return 1;
    }

    const password = parsedPassword.data;
    if (password !== rawConfirmation.trim()) {
      dependencies.logger.error("Passwords do not match");
      return 1;
    }

    const passwordHash = await dependencies.hashPassword(password);
    const updated = await dependencies.updatePasswordHash(user.id, passwordHash);
    if (!updated) {
      dependencies.logger.error(`Failed to update password for user "${username}"`);
      return 1;
    }

    dependencies.logger.info(`Password reset for user "${username}"`);
    return 0;
  } catch (error) {
    if (error instanceof ExitSignal) {
      return error.code;
    }
    // Keep the raw password and untrusted storage/hash error details out of logs.
    dependencies.logger.error("Failed to reset password");
    return 1;
  }
}

function closeNonTtyReader() {
  nonTtyReader?.close();
}

// process.exit() is avoided here so Pino's async transport (worker-thread based
// in non-test environments) has a chance to flush pending writes before the
// process ends; process.exitCode + letting the event loop drain naturally
// achieves the same result without losing log output.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } finally {
    closeNonTtyReader();
  }
}
