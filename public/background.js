// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("bookmarkit extension installed.");
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

// #10: A host is private/loopback/link-local (or non-public). Mirrors
// isPrivateOrLoopbackHost in src/utils/url.js (the service worker can't import
// the app bundle). Keep the two in sync.
function isPrivateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  return false;
}

function mappedIpv4(host) {
  const m = host.match(/^::ffff:(.+)$/i);
  if (!m) return null;
  const rest = m[1];
  if (rest.includes(".")) return rest;
  const parts = rest.split(":");
  if (parts.length !== 2) return null;
  const hi = parseInt(parts[0], 16);
  const lo = parseInt(parts[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function isPrivateOrLoopbackHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(":")) {
    // IPv6 literal only — never match domains that merely start with these.
    if (host === "::1" || host === "::") return true;
    if (host.startsWith("fc") || host.startsWith("fd")) return true; // unique-local
    if (host.startsWith("fe80")) return true; // link-local
    const v4 = mappedIpv4(host);
    if (v4 && isPrivateIpv4(v4)) return true;
  }
  return false;
}

function isPublicHttpUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return !isPrivateOrLoopbackHost(u.hostname);
}

// URL validation — runs in the service worker context which bypasses CORS restrictions.
// Returns { status: 'valid'|'invalid', redirectUrl: string|null }
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "CHECK_URL") return false;
  // #10: only accept requests from our own extension pages (not other extensions
  // or web pages), and only fetch public http(s) URLs — never internal hosts (SSRF).
  if (sender.id !== chrome.runtime.id) return false;
  const url = message.url;
  if (!isPublicHttpUrl(url)) {
    sendResponse({ status: "invalid", redirectUrl: null });
    return false;
  }
  // #10 (Codex): do NOT let fetch follow redirects from the privileged worker —
  // a 30x Location could point at an internal host (127.0.0.1 / 169.254.169.254),
  // and the redirected request fires before we could inspect it. `redirect: "manual"`
  // stops the follow; a redirect yields an opaqueredirect response we treat as
  // "reachable, but we don't chase or expose the target."
  fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) })
    .then((res) => {
      if (res.type === "opaqueredirect") {
        sendResponse({ status: "valid", redirectUrl: null });
        return;
      }
      sendResponse({ status: res.ok ? "valid" : "invalid", redirectUrl: null });
    })
    .catch(() => sendResponse({ status: "invalid", redirectUrl: null }));
  return true; // keep message channel open for async response
});
