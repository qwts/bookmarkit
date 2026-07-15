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
function isPrivateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0 || a === 127) return true; // this-host / loopback
  if (a === 10) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  return false;
}

// Extract the embedded IPv4 from an IPv4-mapped IPv6 host. Browsers normalize
// `::ffff:127.0.0.1` to the hex form `::ffff:7f00:1`, so handle both.
function mappedIpv4(host) {
  const m = host.match(/^::ffff:(.+)$/i);
  if (!m) return null;
  const rest = m[1];
  if (rest.includes(".")) return rest; // ::ffff:127.0.0.1
  const parts = rest.split(":");
  if (parts.length !== 2) return null;
  const hi = parseInt(parts[0], 16);
  const lo = parseInt(parts[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isPrivateOrLoopbackHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (isPrivateIpv4(host)) return true;
  const isIpv6 = host.includes(":");
  if (isIpv6) {
    if (host === "::1" || host === "::") return true;
    // IPv6 prefix checks apply only to literals, never to domain names such
    // as "fcbarcelona.com" or "fdn.example" (Codex #33).
    if (host.startsWith("fc") || host.startsWith("fd")) return true; // unique-local
    if (host.startsWith("fe80")) return true; // link-local
    // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1 / ::ffff:7f00:1 (Codex #33).
    const v4 = mappedIpv4(host);
    if (v4 && isPrivateIpv4(v4)) return true;
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
