/* StatsService：隊伍等級成長與角色能力值計算。
   所有角色共用「隊伍等級」；素質 = 職業基礎 × 等級成長 × 裝備 × 套裝。 */
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

  expNeeded(level) {
    return 60 + level * 45;
  }

  /* 可同時上陣人數：3 起始，一周目+1、二周目+1，上限 5（第 6 格為未來擴充預留） */
  fieldCap() {
    return Math.min(5, 3 + this.state.worldClear);
  }

  /* 陣型中實際上陣的角色（超出人數上限的忽略） */
  partyIds() {
    const cap = this.fieldCap();
    const ids = [];
    for (const id of this.state.formation) {
      if (id && ids.length < cap && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  rowOf(id) {
    const i = this.state.formation.indexOf(id);
    return i >= 3 ? "back" : "front";
  }

  setCounts(items) {
    const counts = {};
    for (const i of items) counts[i.set] = (counts[i.set] || 0) + 1;
    return counts;
  }

  setTier(n) {
    return n >= 5 ? 5 : n >= 3 ? 3 : n >= 2 ? 2 : 0;
  }

  /* 完整素質：生命/攻擊/防禦/爆擊率/爆擊傷害/攻速/技能時間倍率(cdr，越高越快) */
  effectiveStats(c, overrideItem = null) {
    const j = this.book.job[c.job];
    const growth = 1 + (this.state.teamLevel - 1) * 0.06;
    let hp = j.hp * growth, atk = j.atk * growth, def = j.def * growth;
    let crit = j.crit, critDmg = j.critDmg, aspd = j.aspd, cdr = 1;
    const items = this.game.equipment.equippedItems(c.id, overrideItem);
    for (const i of items) {
      hp += Number(i.hp) || 0;
      atk += Number(i.atk) || 0;
      def += Number(i.def) || 0;
      aspd += Number(i.speed) || 0;
      crit += Number(i.crit) || 0;
    }
    for (const [set, n] of Object.entries(this.setCounts(items))) {
      const tier = this.setTier(n);
      if (set === "史萊姆" && tier >= 2) hp *= 1.15;
      if (set === "哥布林" && tier >= 2) aspd *= 1.10;
      if (set === "狼牙" && tier >= 2) crit += 0.10;
      if (set === "魔王" && tier >= 2) { hp *= 1.08; atk *= 1.08; def *= 1.08; }
    }
    return { maxHp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), crit: +crit.toFixed(3), critDmg: +critDmg.toFixed(2), aspd: +aspd.toFixed(2), cdr: +cdr.toFixed(2) };
  }
}
