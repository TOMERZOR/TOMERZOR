/* Tokef boot: picks the view, renders, then connects the platform. */

function App() {
  const S = useStore();
  const nav = useNav();
  if (S.mode === 'boot' || !S.loaded.projects) return html`<${Loading} />`;
  if (nav.view === 'portal' && S.projects.length) return html`<${Portal} key=${'u' + nav.id} id=${nav.id} />`;
  if (!S.projects.length) return html`<${Welcome} />`;
  let view;
  switch (nav.view) {
    case 'sub': view = html`<${SubView} id=${nav.id} />`; break;
    case 'check': view = html`<${CheckView} sid0=${nav.id} />`; break;
    case 'gate': view = html`<${Gate} />`; break;
    case 'rules': view = html`<${Rules} />`; break;
    case 'log': view = html`<${Log} />`; break;
    case 'project': view = html`<${ProjectSettings} />`; break;
    default: view = html`<${Dashboard} />`;
  }
  return html`<${Shell}><${Fragment} key=${nav.view + ':' + (nav.id || '') + ':' + (S.pid || '')}>${view}<//><//>`;
}

(function boot() {
  try { document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl'; } catch (e) {}
  const first = Nav.parse(location.hash);
  Nav.view = first.view;
  Nav.id = first.id;
  const root = document.getElementById('app');
  root.textContent = '';
  render(html`<${App} />`, root);
  bootPlatform().catch((e) => { console.error(e); Store.attach(makeLocalDB('tokef.local.v1'), 'local'); });
  window.addEventListener('hashchange', () => {
    const n = Nav.parse(location.hash);
    if (n.view !== Nav.view || n.id !== Nav.id) Nav.go(n.view, n.id);
  });
})();
