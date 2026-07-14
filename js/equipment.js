/* EquipmentService：裝備的查詢、穿脫、一鍵裝備、分解與戰利品掉落。
   只改動 state 並負責 persist；畫面更新由呼叫端（UIController）處理。 */
class EquipmentService {
  constructor(game) {
    this.game = game;
  }

  get state() {
    return this.game.state;
  }

  /* 綜合評分：一鍵裝備與分解精隨量的依據 */
  itemScore(i) {
    return (Number(i.atk) || 0) * 2 + (Number(i.hp) || 0) * 0.35 + (Number(i.def) || 0) * 3 + (Number(i.speed) || 0) * 100 + (Number(i.crit) || 0) * 500;
  }

  findWearer(itemId) {
    for (const [cid, eq] of Object.entries(this.state.equipped)) {
      for (const eid of Object.values(eq || {})) if (eid === itemId) return cid;
    }
    return null;
  }

  slotItemOf(cid, slot) {
    const id = (this.state.equipped[cid] || {})[slot];
    return this.state.inventory.find((i) => i.id === id) || null;
  }

  /* 角色目前穿的裝備；overrideItem 用於「換上這件會如何」的試算（取代同部位） */
  equippedItems(cid, overrideItem = null) {
    const eq = this.state.equipped[cid] || {};
    const items = [];
    for (const [slot, id] of Object.entries(eq)) {
      if (overrideItem && slot === overrideItem.slot) continue;
      const item = this.state.inventory.find((i) => i.id === id);
      if (item) items.push(item);
    }
    if (overrideItem) items.push(overrideItem);
    return items;
  }

  /* 穿上裝備；若他人配戴中會自動轉移過來 */
  equip(itemId, cid) {
    const item = this.state.inventory.find((x) => x.id === itemId);
    if (!item || !cid) return false;
    for (const eq of Object.values(this.state.equipped)) {
      for (const [slot, id] of Object.entries(eq || {})) if (id === itemId) delete eq[slot];
    }
    this.state.equipped[cid] ||= {};
    this.state.equipped[cid][item.slot] = itemId;
    this.state.battle = null;
    this.game.persist();
    return true;
  }

  unequip(cid, slot) {
    const eq = this.state.equipped[cid];
    if (!eq || !eq[slot]) return false;
    delete eq[slot];
    this.state.battle = null;
    this.game.persist();
    return true;
  }

  /* 每部位換上背包中「無人配戴」的最高分裝備（不搶他人的、不換掉更好的） */
  autoEquip(cid) {
    let changed = 0;
    for (const slot of Object.keys(this.game.config.SLOTS)) {
      const candidates = this.state.inventory.filter((i) => i.slot === slot && !this.findWearer(i.id));
      if (!candidates.length) continue;
      const best = candidates.sort((a, b) => this.itemScore(b) - this.itemScore(a))[0];
      const cur = this.slotItemOf(cid, slot);
      if (cur && this.itemScore(cur) >= this.itemScore(best)) continue;
      this.state.equipped[cid] ||= {};
      this.state.equipped[cid][slot] = best.id;
      changed++;
    }
    if (changed) {
      this.state.battle = null;
      this.game.persist();
      this.game.view.log(`${this.game.book.labelOf(cid)} 一鍵裝備：換上 ${changed} 件無人配戴的最強裝備。`, "system");
    }
    return changed;
  }

  salvageGain(item) {
    return Math.max(1, Math.round(this.itemScore(item) / 30));
  }

  /* 分解裝備 → 礦物精隨；鎖定中不可分解；配戴中的會先確認並卸下 */
  salvage(itemId) {
    const index = this.state.inventory.findIndex((x) => x.id === itemId);
    if (index < 0) return false;
    const item = this.state.inventory[index];
    if (item.locked) {
      alert(`「${item.name}」已鎖定，請先解鎖再分解。`);
      return false;
    }
    const wearer = this.findWearer(itemId);
    if (wearer && !confirm(`「${item.name}」目前由 ${this.game.book.labelOf(wearer)} 配戴中，確定要分解？`)) return false;
    const gain = this.salvageGain(item);
    if (wearer) {
      const eq = this.state.equipped[wearer];
      for (const [slot, id] of Object.entries(eq)) if (id === itemId) delete eq[slot];
      this.state.battle = null;
    }
    this.state.inventory.splice(index, 1);
    this.state.mineralEssence += gain;
    this.game.view.log(`分解「${item.name}」，獲得礦物精隨 ${gain}。`, "drop");
    this.game.persist();
    return true;
  }

  /* 戰鬥勝利的裝備掉落：無數量上限，掉落率相應調降（普通 5%／菁英 20%／Boss 60%） */
  rollDrop(map, tier) {
    const chance = this.state.stage === 10 ? 0.6 : this.state.stage === 5 ? 0.20 : 0.05;
    if (Math.random() >= chance) return;
    const SLOTS = this.game.config.SLOTS;
    const slot = rand(Object.keys(SLOTS));
    const set = map.set;
    const q = 1 + Math.floor(Math.random() * 3) + Math.floor(tier / 3);
    const item = {
      id: `eq_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: `${set}${SLOTS[slot]}`,
      set,
      slot,
      hp: ["head", "body", "off"].includes(slot) ? Math.round((8 + q * 6) * (1 + tier * 0.14)) : Math.floor(q * 2),
      atk: slot === "main" ? Math.round((5 + q * 5) * (1 + tier * 0.13)) : Math.floor(q * 1.5),
      def: ["body", "head"].includes(slot) ? 2 + q * 2 : 0,
      speed: slot === "feet" ? q * 0.02 : 0,
      crit: slot === "main" ? q * 0.006 : 0,
    };
    this.state.inventory.push(item);
    this.game.view.log(`掉落「${item.name}」｜攻擊+${item.atk} 生命+${item.hp} 防禦+${item.def}。`, "drop");
  }

  /* 鎖定／解鎖：鎖定中的裝備不能被分解或批量選取 */
  toggleLock(itemId) {
    const item = this.state.inventory.find((x) => x.id === itemId);
    if (!item) return false;
    item.locked = !item.locked;
    this.game.persist();
    return item.locked;
  }

  /* 批量分解（跳過鎖定與配戴中的），一次入帳並記錄 */
  bulkSalvage(itemIds) {
    let gain = 0, count = 0;
    for (const id of itemIds) {
      const index = this.state.inventory.findIndex((x) => x.id === id);
      if (index < 0) continue;
      const item = this.state.inventory[index];
      if (item.locked || this.findWearer(id)) continue;
      gain += this.salvageGain(item);
      this.state.inventory.splice(index, 1);
      count++;
    }
    if (count) {
      this.state.mineralEssence += gain;
      this.game.view.log(`一鍵分解 ${count} 件裝備，獲得礦物精隨 ${gain}。`, "drop");
      this.game.persist();
    }
    return { count, gain };
  }
}
