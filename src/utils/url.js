// URL and HTML safety helpers shared across the app.

// #11: Only http(s) URLs are safe to navigate to or import. This blocks
// javascript:, data:, file:, blob:, chrome:, etc. which can execute code or
// exfiltrate context when opened.
export function isSafeHttpUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

// #10: A host is private/loopback/link-local (or otherwise non-public) if it
// resolves to the local machine or an internal network. Used to keep the
// privileged service-worker fetch (CHECK_URL) from being pointed at internal
// resources (SSRF). Mirrored in public/background.js, which cannot import this.
export function isPrivateOrLoopbackHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // IPv6 unique-local
  if (host.startsWith("fe80")) return true; // IPv6 link-local
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 127) return true; // this-host / loopback
    if (a === 10) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  }
  return false;
}

// #10: Safe target for the privileged background fetch — http(s) to a public host.
export function isPublicHttpUrl(url) {
  if (!isSafeHttpUrl(url)) return false;
  try {
    return !isPrivateOrLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

// #12: Escape a value for safe interpolation into HTML text or a double-quoted
// attribute (used when building the Netscape bookmark export by hand).
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
