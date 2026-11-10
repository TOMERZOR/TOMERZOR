// Placeholder until the online module is written.
export class Online {
  constructor(game) { this.game = game; this.active = false; this.peers = new Map(); this.room = ''; }
  lobby() { this.game.menu.panel.innerHTML = '<h3>אונליין</h3><p class="lead">בקרוב.</p>'; }
  update() {} leave() {} onDown() {}
}
