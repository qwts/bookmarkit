import { describe, it, expect } from "vitest";
import { encryptString, decryptString, isEncryptedBlob } from "./keyCrypto.js";

describe("keyCrypto (#29)", () => {
  it("round-trips a secret with the correct passphrase", async () => {
    const secret = JSON.stringify({ gemini: { apiKey: "sk-secret-123", model: "x" } });
    const blob = await encryptString(secret, "correct horse battery staple");
    expect(await decryptString(blob, "correct horse battery staple")).toBe(secret);
  });

  it("never stores the plaintext or passphrase in the blob", async () => {
    const blob = await encryptString("sk-secret-123", "hunter2");
    expect(blob).not.toContain("sk-secret-123");
    expect(blob).not.toContain("hunter2");
    const parsed = JSON.parse(blob);
    expect(parsed).toHaveProperty("ciphertext");
    expect(parsed).toHaveProperty("salt");
    expect(parsed).toHaveProperty("iv");
    expect(parsed).not.toHaveProperty("passphrase");
    expect(parsed).not.toHaveProperty("key");
  });

  it("fails to decrypt with a wrong passphrase", async () => {
    const blob = await encryptString("secret", "right");
    await expect(decryptString(blob, "wrong")).rejects.toBeTruthy();
  });

  it("uses a fresh salt+iv each time (different ciphertext for same input)", async () => {
    const a = await encryptString("same", "pw");
    const b = await encryptString("same", "pw");
    expect(a).not.toBe(b);
    expect(await decryptString(a, "pw")).toBe("same");
    expect(await decryptString(b, "pw")).toBe("same");
  });

  it("requires a passphrase to encrypt", async () => {
    await expect(encryptString("x", "")).rejects.toThrow();
  });

  it("recognizes its own blobs", async () => {
    expect(isEncryptedBlob(await encryptString("x", "pw"))).toBe(true);
    expect(isEncryptedBlob('{"gemini":{"apiKey":"x"}}')).toBe(false);
    expect(isEncryptedBlob("not json")).toBe(false);
    expect(isEncryptedBlob(null)).toBe(false);
  });
});
