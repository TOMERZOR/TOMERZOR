(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const IMAGE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i;
  const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
  // Keep the key from the QR link on every request, so it works even if Safari drops the cookie.
  const key = new URLSearchParams(location.search).get("k") || "";
  const withKey = (url) => (key ? url + (url.includes("?") ? "&" : "?") + "k=" + encodeURIComponent(key) : url);

  let info = null;
  let lastVersion = -1;
  const uploadQueue = [];
  let uploading = false;

  // ---------- helpers ----------

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "style") node.style.cssText = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  // Wrapped in a left-to-right isolate so "13 KB" doesn't flip inside Hebrew text.
  const ltr = (s) => "\u2066" + s + "\u2069";

  function size(n) {
    if (n < 1024) return ltr(n + " B");
    const units = ["KB", "MB", "GB"];
    let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    return ltr(n.toFixed(n < 10 ? 1 : 0) + " " + units[i]);
  }

  function ago(t) {
    const s = Math.max(0, Date.now() / 1000 - t);
    if (s < 45) return "עכשיו";
    if (s < 3600) return `לפני ${Math.round(s / 60)} דק׳`;
    return new Date(t * 1000).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }

  function ext(name) {
    const m = /\.([^.]{1,5})$/.exec(name);
    return m ? m[1] : "file";
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  async function api(path, opts = {}) {
    const res = await fetch(withKey(path), { cache: "no-store", ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  // The page is served over plain http on the LAN, where navigator.clipboard
  // is unavailable, so fall back to the selection trick (works in iOS Safari).
  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through */ }
    const ta = el("textarea", { readonly: "", style: "position:fixed;top:0;left:0;opacity:0;font-size:16px" });
    ta.value = text;
    document.body.append(ta);
    ta.contentEditable = "true";
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    ta.remove();
    sel.removeAllRanges();
    return ok;
  }

  function linkify(text) {
    const frag = document.createDocumentFragment();
    const re = /https?:\/\/[^\s<>"]+/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      frag.append(text.slice(last, m.index));
      frag.append(el("a", { href: m[0], target: "_blank", rel: "noopener" }, m[0]));
      last = m.index + m[0].length;
    }
    frag.append(text.slice(last));
    return frag;
  }

  // ---------- rendering ----------

  function fileUrl(name, view) {
    return withKey("/files/" + encodeURIComponent(name) + (view ? "?view=1" : ""));
  }

  function thumb(name, src) {
    const t = el("span", { class: "thumb" });
    if (src && IMAGE.test(name) && !/\.hei[cf]$/i.test(name)) t.style.backgroundImage = `url("${src}")`;
    else t.textContent = VIDEO.test(name) ? "▶" : ext(name);
    return t;
  }

  function renderOutbox(files) {
    const list = $("outbox");
    list.replaceChildren();
    $("outbox-empty").hidden = files.length > 0;
    $("save-hint").hidden = !files.some((f) => IMAGE.test(f.name) || VIDEO.test(f.name));
    for (const f of files) {
      const media = IMAGE.test(f.name) || VIDEO.test(f.name);
      const actions = info.host
        ? el("button", { class: "icon-btn", title: "הסרה", "aria-label": "הסרה", onclick: () => removeShared(f.name) }, "×")
        : el("a", { class: "btn", href: fileUrl(f.name), download: f.name }, "הורדה");
      const thumbNode = thumb(f.name, fileUrl(f.name, true));
      const opener = media && !info.host
        ? el("a", { href: fileUrl(f.name, true), target: "_blank", rel: "noopener", style: "line-height:0" }, thumbNode)
        : thumbNode;
      list.append(el("li", {},
        opener,
        el("span", { class: "meta" },
          el("span", { class: "name", title: f.name }, f.name),
          el("span", { class: "size" }, `${size(f.size)} · ${ago(f.mtime)}`)),
        actions));
    }
  }

  function renderReceived(files) {
    const list = $("received");
    list.replaceChildren();
    $("received-empty").hidden = files.length > 0;
    for (const f of files) {
      list.append(el("li", {},
        thumb(f.name),
        el("span", { class: "meta" },
          el("span", { class: "name", title: f.name }, f.name),
          el("span", { class: "size" }, `${size(f.size)} · ${ago(f.time)}`))));
    }
  }

  function renderMessages(messages) {
    const list = $("messages");
    list.replaceChildren();
    $("clear-messages").hidden = !messages.length;
    for (const m of messages) {
      const mine = (m.from === "pc") === info.host;
      const who = mine ? "שלחתם" : m.from === "pc" ? "מהמחשב" : "מהאייפון";
      const btn = el("button", { class: "btn", type: "button" }, "העתקה");
      btn.addEventListener("click", async () => {
        toast((await copy(m.text)) ? "הועתק" : "לא הצלחתי להעתיק. סמנו את הטקסט ידנית");
      });
      list.append(el("li", {},
        el("p", { class: "msg-text", dir: "auto" }, linkify(m.text)),
        el("div", { class: "msg-foot" }, el("span", {}, `${who} · ${ago(m.time)}`), btn)));
    }
  }

  function render(state) {
    renderOutbox(state.outbox);
    renderMessages(state.messages);
    if (info.host) renderReceived(state.received);
  }

  async function refresh(force) {
    try {
      const state = await api("/api/state");
      if (force === true || state.version !== lastVersion) {
        lastVersion = state.version;
        render(state);
        notifyNew(state);
      }
      setLive(true);
    } catch (e) {
      setLive(false);
    }
  }

  let seenOutbox = null, seenMsgs = null, seenReceived = null;
  function notifyNew(state) {
    const outCount = state.outbox.length, msgCount = state.messages[0] && state.messages[0].id;
    const recCount = state.received.length;
    if (!info.host && seenOutbox !== null && outCount > seenOutbox) toast("קובץ חדש מהמחשב");
    if (seenMsgs !== null && msgCount && msgCount !== seenMsgs) {
      const m = state.messages[0];
      if ((m.from === "pc") !== info.host) toast(info.host ? "טקסט חדש מהאייפון" : "טקסט חדש מהמחשב");
    }
    if (info.host && seenReceived !== null && recCount > seenReceived) toast("התקבל קובץ מהאייפון");
    remember(state);
  }
  function remember(state) {
    seenOutbox = state.outbox.length;
    seenMsgs = state.messages[0] ? state.messages[0].id : "";
    seenReceived = state.received.length;
  }

  function setLive(on) {
    $("live").classList.toggle("on", on);
    $("live").title = on ? "מחובר" : "אין חיבור למחשב";
    if (!on) $("subtitle").textContent = "אין חיבור. האם WiFiDrop עדיין פתוח במחשב?";
    else if (info) $("subtitle").textContent = info.host ? `פועל על ${info.computer}` : `מחובר אל ${info.computer}`;
  }

  // ---------- live updates ----------

  function listen() {
    if (!window.EventSource) return setInterval(refresh, 3000);
    let es;
    const connect = () => {
      es = new EventSource(withKey("/api/events"));
      es.onmessage = () => refresh();
      es.onopen = () => setLive(true);
      es.onerror = () => {
        setLive(false);
        if (es.readyState === EventSource.CLOSED) setTimeout(connect, 3000);
      };
    };
    connect();
    // Safari pauses background tabs; catch up as soon as the page is visible again.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refresh();
        if (es && es.readyState === EventSource.CLOSED) connect();
      }
    });
  }

  // ---------- uploads ----------

  function queueFiles(files) {
    for (const file of files) {
      const bar = el("i");
      const status = el("span", { class: "size" }, "ממתין…");
      const row = el("li", {},
        thumb(file.name),
        el("span", { class: "meta" },
          el("span", { class: "name", title: file.name }, file.name || "קובץ"),
          status,
          el("div", { class: "bar" }, bar)));
      $("uploads").prepend(row);
      uploadQueue.push({ file, row, bar, status });
    }
    pump();
  }

  function pump() {
    if (uploading || !uploadQueue.length) return;
    uploading = true;
    const job = uploadQueue.shift();
    const { file, row, bar, status } = job;
    const xhr = new XMLHttpRequest();
    let url = "/api/upload?name=" + encodeURIComponent(file.name || "");
    if (info.host) url += "&to=iphone";
    xhr.open("POST", withKey(url));
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    const started = Date.now();
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = e.loaded / e.total;
      bar.style.width = (pct * 100).toFixed(1) + "%";
      const secs = (Date.now() - started) / 1000;
      const speed = secs > 0.5 ? ` · ${size(e.loaded / secs)}/s` : "";
      status.textContent = `${size(e.loaded)} מתוך ${size(e.total)}${speed}`;
    };
    const finish = (ok, msg) => {
      row.classList.add(ok ? "done" : "failed");
      bar.style.width = "100%";
      status.textContent = msg;
      uploading = false;
      if (ok) setTimeout(() => row.remove(), 6000);
      pump();
    };
    xhr.onload = () => {
      if (xhr.status === 200) finish(true, `נשלח · ${size(file.size)}`);
      else {
        let err = xhr.statusText;
        try { err = JSON.parse(xhr.responseText).error || err; } catch (_) { /* keep statusText */ }
        finish(false, "נכשל: " + err);
      }
    };
    xhr.onerror = () => finish(false, "נכשל: החיבור למחשב נקטע");
    status.textContent = "שולח…";
    xhr.send(file);
  }

  function setupDrop() {
    const drop = $("drop"), picker = $("picker");
    picker.addEventListener("change", () => {
      if (picker.files.length) queueFiles([...picker.files]);
      picker.value = "";
    });
    let depth = 0;
    document.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; drop.classList.add("over"); });
    document.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; drop.classList.remove("over"); } });
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      drop.classList.remove("over");
      const files = [...(e.dataTransfer.files || [])].filter((f) => f.size || f.type);
      if (files.length) queueFiles(files);
    });
    document.addEventListener("paste", (e) => {
      if (e.target === $("text")) return;
      const files = [...(e.clipboardData.files || [])];
      if (files.length) {
        e.preventDefault();
        queueFiles(files.map((f) => (f.name && f.name !== "image.png" ? f
          : new File([f], `צילום מסך ${new Date().toLocaleString("he-IL").replace(/[/:]/g, "-")}.png`, { type: f.type }))));
      }
    });
  }

  async function removeShared(name) {
    try {
      await api("/files/" + encodeURIComponent(name), { method: "DELETE" });
    } catch (e) {
      toast(e.message);
    }
  }

  // ---------- text ----------

  function setupText() {
    const form = $("text-form"), box = $("text");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = box.value.trim();
      if (!text) return box.focus();
      try {
        await api("/api/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        box.value = "";
        toast(info.host ? "נשלח לאייפון" : "נשלח למחשב");
      } catch (err) {
        toast("לא נשלח: " + err.message);
      }
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit();
    });
    $("clear-messages").addEventListener("click", () => api("/api/messages", { method: "DELETE" }).catch((e) => toast(e.message)));
  }

  // ---------- PC page ----------

  function drawQr(url) {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    $("qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  }

  function setupPc() {
    document.body.classList.add("is-pc");
    drawQr(info.url);
    $("url").textContent = info.url;
    $("folder").textContent = info.folder;
    if (info.otherUrls.length) {
      $("other-urls").hidden = false;
      for (const u of info.otherUrls) $("other-list").append(el("li", {}, el("code", {}, u)));
    }
    document.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => api("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: b.dataset.open }),
      }).catch((e) => toast(e.message))));
  }

  // ---------- start ----------

  async function start() {
    try {
      info = await api("/api/info");
    } catch (e) {
      $("subtitle").textContent = e.message;
      return;
    }
    if (info.host) setupPc();
    setupDrop();
    setupText();
    const state = await api("/api/state").catch(() => null);
    if (state) {
      lastVersion = state.version;
      render(state);
      remember(state);
      setLive(true);
    }
    listen();
    // Keeps the "x minutes ago" labels current.
    setInterval(() => refresh(true), 60000);
  }

  start();
})();
