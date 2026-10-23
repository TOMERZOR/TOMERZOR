// Client for the FitSource API (worker/). The scan endpoint streams one JSON
// object per line: progress first, then the result or an error.

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function fetchHealth(apiBase, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase}/api/health`, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    const data = await res.json();
    return data && data.ok ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function deepScan(apiBase, { image, focus = null, hint = null }, { onEvent = () => {}, signal } = {}) {
  let res;
  try {
    res = await fetch(`${apiBase}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image, focus, hint }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("network", "Could not reach the scan server.");
  }
  if (!res.ok) {
    let body = {};
    try {
      body = await res.json();
    } catch {
      // not JSON
    }
    throw new ApiError(body.error || `http_${res.status}`, body.message || "The scan server returned an error.");
  }
  if (!res.body || !res.body.getReader) throw new ApiError("stream", "This browser cannot read the scan stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  const handle = (line) => {
    if (!line.trim()) return;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      return;
    }
    if (ev.t === "result") result = ev;
    else if (ev.t === "error") throw new ApiError(ev.code || "scan_failed", ev.message || "The scan failed.");
    else onEvent(ev);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      handle(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  handle(buffer + decoder.decode());
  if (!result) throw new ApiError("incomplete", "The scan stopped before it finished. Try again.");
  return { ...result.data, cached: Boolean(result.cached) };
}
