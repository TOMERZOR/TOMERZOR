// The home card must not show a stale streak, and must show a live one.
export default async ({ page, wait }) => {
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return key(d); };
  const cases = [
    ['broken (last played 2 days ago)', { last: day(-2), streak: 5, best: 5, done: { [day(-2)]: 3 } }, 'A new puzzle every day'],
    ['alive (played yesterday)', { last: day(-1), streak: 5, best: 5, done: { [day(-1)]: 3 } }, '5-day streak · keep it going'],
    ['done today', { last: day(0), streak: 6, best: 6, done: { [day(0)]: 3 } }, '6-day streak · back tomorrow'],
  ];
  for (const [name, daily, expect] of cases) {
    // write through the game's own save (it flushes its in-memory copy on pagehide)
    await page.evaluate((daily) => { const s = window.__shard.save; s.d.stars['w0-1'] = 3; s.d.daily = daily; s.flush(); }, daily);
    await page.reload();
    await wait(700);
    const txt = await page.textContent('#daily-sub');
    console.log(`${txt === expect ? 'PASS' : 'FAIL'} ${name}: "${txt}"`);
  }
};
