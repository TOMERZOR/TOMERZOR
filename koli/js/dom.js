// A tiny element builder. Text always goes in as text, never as HTML.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

let toastTimer;
export function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth; // restart the entrance animation for back-to-back toasts
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

/** A labelled input. */
export function field(label, input, hint, wide) {
  return h("label", { class: `field${wide ? " wide" : ""}` }, h("span", {}, label), input, hint && h("small", {}, hint));
}

export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    toast("הועתק");
  } catch {
    const code = btn?.parentElement?.querySelector("code");
    if (code) {
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    toast("סמנו והעתיקו ידנית");
  }
}

/** Run an async action with the button disabled and a busy label. */
export async function busy(btn, label, fn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.classList.add("busy");
  btn.textContent = label;
  try {
    return await fn();
  } catch (err) {
    toast(err.message || "משהו השתבש");
    return undefined;
  } finally {
    btn.disabled = false;
    btn.classList.remove("busy");
    btn.textContent = old;
  }
}
