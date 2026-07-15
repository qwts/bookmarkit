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
function isPrivateOrLoopbackHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // IPv6 unique-local
  if (host.startsWith("fe80")) return true; // IPv6 link-local
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
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
  fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) })
    .then((res) => {
      const redirectUrl = res.url && res.url !== url ? res.url : null;
      sendResponse({ status: res.ok ? "valid" : "invalid", redirectUrl });
    })
    .catch(() => sendResponse({ status: "invalid", redirectUrl: null }));
  return true; // keep message channel open for async response
});
