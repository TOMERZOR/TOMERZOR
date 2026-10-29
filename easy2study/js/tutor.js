// Easy2Study: talks to the AI tutor (worker/). With no address in config.js,
// or when the server says no, the app keeps working with the built-in lessons
// and the help each bite carries.
window.E2STutor = (() => {
  const base = ((window.E2S_CONFIG && window.E2S_CONFIG.apiBase) || "").replace(/\/+$/, "");

  async function post(path, body, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `http_${res.status}`);
        err.code = data.error || `http_${res.status}`;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === "AbortError") {
        const err = new Error("timeout");
        err.code = "timeout";
        throw err;
      }
      if (!e.code) e.code = "network";
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    available: () => Boolean(base),
    // {profile, topic, subject?, material?, image?: {media_type, data}, goal, when?} -> {plan: {title, subtitle, chapters, notes}}
    plan: (body) => post("/api/plan", body, 90000),
    // the same, plus course: {title, chapters, index, goal, learned} -> {lesson}
    lesson: (body) => post("/api/lesson", body, 120000),
    // {profile, lesson: {title, subject}, bite: {title, text}, kind, word?, question?} -> {text, example}
    help: (body) => post("/api/help", body, 60000),
  };
})();
