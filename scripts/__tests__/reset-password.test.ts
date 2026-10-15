import { describe, expect, it, vi } from "vitest";
import { runPasswordReset, type PasswordResetDependencies } from "../reset-password.js";

function makeDependencies() {
  const findUserByUsername = vi.fn<PasswordResetDependencies["findUserByUsername"]>();
  const updatePasswordHash = vi.fn<PasswordResetDependencies["updatePasswordHash"]>();
  const hashPassword = vi.fn<PasswordResetDependencies["hashPassword"]>();
  const promptPassword = vi.fn<PasswordResetDependencies["promptPassword"]>();
  const logger = {
    error: vi.fn<PasswordResetDependencies["logger"]["error"]>(),
    info: vi.fn<PasswordResetDependencies["logger"]["info"]>(),
  };

  findUserByUsername.mockResolvedValue({ id: "user-1" });
  updatePasswordHash.mockResolvedValue({ id: "user-1" });
  hashPassword.mockResolvedValue("bcrypt-hash");

  return {
    dependencies: {
      findUserByUsername,
      updatePasswordHash,
      hashPassword,
      promptPassword,
      logger,
    } satisfies PasswordResetDependencies,
    findUserByUsername,
    updatePasswordHash,
    hashPassword,
    promptPassword,
    logger,
  };
}

describe("runPasswordReset", () => {
  it.each([{ args: [] as string[] }, { args: ["admin", "password-in-argv"] }])(
    "rejects missing or extra arguments without looking up an account",
    async ({ args }) => {
      const setup = makeDependencies();

      await expect(runPasswordReset(args, setup.dependencies)).resolves.toBe(1);

      expect(setup.findUserByUsername).not.toHaveBeenCalled();
      expect(setup.promptPassword).not.toHaveBeenCalled();
      expect(setup.logger.error).toHaveBeenCalledWith(
        "Usage: npm run reset-password -- <username>"
      );
    }
  );

  it("stops before prompting when the account does not exist", async () => {
    const setup = makeDependencies();
    setup.findUserByUsername.mockResolvedValue(undefined);

    await expect(runPasswordReset(["missing"], setup.dependencies)).resolves.toBe(1);

    expect(setup.promptPassword).not.toHaveBeenCalled();
    expect(setup.hashPassword).not.toHaveBeenCalled();
    expect(setup.updatePasswordHash).not.toHaveBeenCalled();
    expect(setup.logger.error).toHaveBeenCalledWith('No user found with username "missing"');
  });

  it.each(["short1", "lettersOnly", "12345678"])(
    "rejects passwords that do not meet the shared policy: %s",
    async (password) => {
      const setup = makeDependencies();
      setup.promptPassword.mockResolvedValueOnce(password).mockResolvedValueOnce(password);

      await expect(runPasswordReset(["admin"], setup.dependencies)).resolves.toBe(1);

      expect(setup.hashPassword).not.toHaveBeenCalled();
      expect(setup.updatePasswordHash).not.toHaveBeenCalled();
      expect(setup.logger.info).not.toHaveBeenCalled();
    }
  );

  it("rejects a confirmation that differs after the app's password trimming", async () => {
    const setup = makeDependencies();
    setup.promptPassword.mockResolvedValueOnce("Recovery123").mockResolvedValueOnce("Other1234");

    await expect(runPasswordReset(["admin"], setup.dependencies)).resolves.toBe(1);

    expect(setup.hashPassword).not.toHaveBeenCalled();
    expect(setup.updatePasswordHash).not.toHaveBeenCalled();
    expect(setup.logger.error).toHaveBeenCalledWith("Passwords do not match");
  });

  it("trims, hashes, and stores a valid password before reporting success", async () => {
    const setup = makeDependencies();
    setup.promptPassword
      .mockResolvedValueOnce("  Recovery123  ")
      .mockResolvedValueOnce("Recovery123");

    await expect(runPasswordReset(["admin"], setup.dependencies)).resolves.toBe(0);

    expect(setup.findUserByUsername).toHaveBeenCalledWith("admin");
    expect(setup.hashPassword).toHaveBeenCalledWith("Recovery123");
    expect(setup.updatePasswordHash).toHaveBeenCalledWith("user-1", "bcrypt-hash");
    expect(setup.logger.info).toHaveBeenCalledWith('Password reset for user "admin"');
    expect(setup.logger.error).not.toHaveBeenCalled();
  });

  it("does not report success when storage declines the password update", async () => {
    const setup = makeDependencies();
    setup.promptPassword.mockResolvedValueOnce("Recovery123").mockResolvedValueOnce("Recovery123");
    setup.updatePasswordHash.mockResolvedValue(undefined);

    await expect(runPasswordReset(["admin"], setup.dependencies)).resolves.toBe(1);

    expect(setup.logger.info).not.toHaveBeenCalled();
    expect(setup.logger.error).toHaveBeenCalledWith('Failed to update password for user "admin"');
  });

  it("keeps rejected hash or storage errors out of logs", async () => {
    const secret = "Recovery123";
    const setup = makeDependencies();
    setup.promptPassword.mockResolvedValueOnce(secret).mockResolvedValueOnce(secret);
    setup.hashPassword.mockRejectedValue(new Error(`hash failed for ${secret}`));

    await expect(runPasswordReset(["admin"], setup.dependencies)).resolves.toBe(1);

    expect(setup.updatePasswordHash).not.toHaveBeenCalled();
    expect(setup.logger.error).toHaveBeenCalledWith("Failed to reset password");
    expect(JSON.stringify(setup.logger.error.mock.calls)).not.toContain(secret);
  });
});
