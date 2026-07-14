/* StatsService：角色成長、能力值計算與種族共鳴。讀取 game.state，不做修改（progressOf 除外：補建缺漏紀錄）。 */
class StatsService {
  constructor(game) {
    this.game = game;
  }

  get state() {
    return this.game.state;
  }

  get book() {
    return this.game.book;
  }

  progressOf(id) {
    this.state.progress[id] ||= { level: 1, exp: 0 };
    return this.state.progress[id];
  }

  expNeeded(level) {
    return 45 + level * 30;
  }

  partySlots() {
    return this.state.worldClear >= 2 ? 5 : this.state.worldClear >= 1 ? 4 : 3;
  }

  heroSlotUnlocked() {
    return this.state.worldClear >= 3;
  }

  cdTimeOf(job) {
    return job === "mage" ? 4.3 : 5.2;
  }

  /* 絕技充能門檻（u 需有 job 與 atk） */
  thresholdOf(u) {
    return u.job === "priest" ? u.atk * 10 : { warrior: 5, paladin: 6, mage: 3, rogue: 2, hunter: 4, warlock: 6 }[u.job] || 5;
  }

  setCounts(items) {
    const counts = {};
    for (const i of items) counts[i.set] = (counts[i.set] || 0) + 1;
    return counts;
  }

  setTier(n) {
    return n >= 5 ? 5 : n >= 3 ? 3 : n >= 2 ? 2 : 0;
  }

  /* 職業基礎 × 等級成長 × 裝備 × 套裝 */
  baseStats(c, overrideItem = null) {
    const j = this.book.job[c.job];
    const p = this.progressOf(c.id);
    const growth = 1 + (p.level - 1) * 0.06;
    let hp = j.hp * growth, atk = j.atk * growth, def = j.def * growth, speed = j.speed;
    let crit = c.job === "rogue" ? 0.18 : 0.08;
    const items = this.game.equipment.equippedItems(c.id, overrideItem);
    for (const i of items) {
      hp += Number(i.hp) || 0;
      atk += Number(i.atk) || 0;
      def += Number(i.def) || 0;
      speed += Number(i.speed) || 0;
      crit += Number(i.crit) || 0;
    }
    for (const [set, n] of Object.entries(this.setCounts(items))) {
      const tier = this.setTier(n);
      if (set === "史萊姆" && tier >= 2) hp *= 1.15;
      if (set === "哥布林" && tier >= 2) speed *= 1.10;
      if (set === "狼牙" && tier >= 2) crit += 0.10;
      if (set === "魔王" && tier >= 2) { hp *= 1.08; atk *= 1.08; def *= 1.08; }
    }
    return { maxHp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), speed: +speed.toFixed(2), crit: +crit.toFixed(3) };
  }

  /* 目前隊伍觸發中的種族共鳴清單 */
  resonance() {
    const counts = {};
    for (const id of this.state.party) {
      const c = this.book.get(id);
      if (c) counts[c.race] = (counts[c.race] || 0) + 1;
    }
    const out = [];
    for (const [race, n] of Object.entries(counts)) {
      const tier = n >= 5 ? 5 : n >= 3 ? 3 : n >= 2 ? 2 : 0;
      if (tier) out.push({ race, tier, text: this.book.race[race].resonance[tier] });
    }
    return out;
  }

  applyResonance(stats) {
    const s = { ...stats };
    for (const r of this.resonance()) {
      if (r.race === "human") { const p = r.tier === 2 ? 0.05 : r.tier === 3 ? 0.10 : 0.20; s.maxHp *= 1 + p; s.atk *= 1 + p; }
      if (r.race === "elf") s.speed *= 1 + (r.tier === 2 ? 0.08 : r.tier === 3 ? 0.15 : 0.25);
      if (r.race === "beastkin") s.crit += r.tier === 2 ? 0.06 : 0.10;
    }
    return { maxHp: Math.round(s.maxHp), atk: Math.round(s.atk), def: Math.round(s.def), speed: +s.speed.toFixed(2), crit: +s.crit.toFixed(3) };
  }

  effectiveStats(c, overrideItem = null) {
    return this.applyResonance(this.baseStats(c, overrideItem));
  }
}
