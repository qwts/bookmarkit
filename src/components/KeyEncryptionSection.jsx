import React, { useState } from "react";

// #29: passphrase encryption-at-rest controls. Rendered regardless of the
// selected provider so a locked key can always be unlocked (a keyless provider
// like ollama/lmstudio must not strand the user with no unlock UI — Codex #36).
const KeyEncryptionSection = ({
  encryption = { encrypted: false, locked: false },
  onEnableEncryption,
  onDisableEncryption,
  onUnlock,
}) => {
  const [passInput, setPassInput] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitEnable = async () => {
    setError("");
    if (passInput.length < 6) { setError("Use a passphrase of at least 6 characters."); return; }
    if (passInput !== passConfirm) { setError("Passphrases don't match."); return; }
    setBusy(true);
    try {
      await onEnableEncryption?.(passInput);
      setPassInput("");
      setPassConfirm("");
    } finally {
      setBusy(false);
    }
  };

  const submitUnlock = async () => {
    setError("");
    setBusy(true);
    try {
      const ok = await onUnlock?.(unlockInput);
      if (ok) setUnlockInput("");
      else setError("Incorrect passphrase.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border pt-3">
      <label className="block text-sm font-medium text-primary-text mb-1">API key encryption</label>
      {!encryption.encrypted && (
        <div className="space-y-2">
          <p className="text-xs text-secondary-text">
            Optionally encrypt your stored API key with a passphrase. You'll enter it once per
            session; if you forget it you'll need to re-enter your API key.
          </p>
          <input
            type="password"
            className="w-full border rounded-md px-3 py-2 themed-input"
            placeholder="Passphrase (min 6 characters)"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-md px-3 py-2 themed-input"
            placeholder="Confirm passphrase"
            value={passConfirm}
            onChange={(e) => setPassConfirm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitEnable(); }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={submitEnable}
            className="px-3 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent-hover disabled:opacity-50"
          >
            Encrypt API key
          </button>
        </div>
      )}
      {encryption.encrypted && encryption.locked && (
        <div className="space-y-2">
          <p className="text-xs text-secondary-text">
            🔒 Your API key is encrypted. Enter your passphrase to unlock it for this session.
          </p>
          <input
            type="password"
            className="w-full border rounded-md px-3 py-2 themed-input"
            placeholder="Passphrase"
            value={unlockInput}
            onChange={(e) => setUnlockInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitUnlock(); }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={submitUnlock}
              className="px-3 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent-hover disabled:opacity-50"
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={() => onDisableEncryption?.()}
              className="text-xs text-secondary-text hover:underline"
            >
              Forgot passphrase? Remove encryption
            </button>
          </div>
        </div>
      )}
      {encryption.encrypted && !encryption.locked && (
        <div className="space-y-2">
          <p className="text-xs text-secondary-text">
            🔓 Your API key is encrypted (unlocked for this session).
          </p>
          <button
            type="button"
            onClick={() => onDisableEncryption?.()}
            className="px-3 py-1.5 border border-border rounded-md text-sm text-primary-text hover:bg-secondary-bg"
          >
            Remove encryption
          </button>
        </div>
      )}
    </div>
  );
};

export default KeyEncryptionSection;
