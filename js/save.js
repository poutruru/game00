/* SaveManager：localStorage 存檔的載入、驗證遷移、寫入與世代重置。 */
class SaveManager {
  constructor(config, book, data) {
    this.config = config;
    this.book = book;
    this.data = data;
  }

  defaultState() {
    return {
      version: this.config.SAVE_VERSION,
      gold: 300,
      essence: 0,
      mineralEssence: 0,
      worldClear: 0,
      unlockedMaps: 1,
      currentMap: "slime",
      stage: 1,
      tiers: Object.fromEntries(this.data.maps.map((m) => [m.id, 1])),
      running: true,
      speed: 1,
      owned: ["human_warrior", "human_priest", "human_mage"],
      party: ["human_warrior", "human_priest", "human_mage"],
      progress: {
        human_warrior: { level: 1, exp: 0 },
        human_priest: { level: 1, exp: 0 },
        human_mage: { level: 1, exp: 0 },
      },
      inventory: [],
      equipped: {},
      battle: null,
      heroSlot: null,
    };
  }

  load() {
    const def = this.defaultState();
    try {
      const raw = JSON.parse(localStorage.getItem(this.config.SAVE_KEY) || "{}");
      if (Object.keys(raw).length && (Number(raw.version) || 0) < this.config.WIPE_BELOW_VERSION) {
        console.warn("存檔世代過舊，全員重置。");
        localStorage.removeItem(this.config.SAVE_KEY);
        return def;
      }
      const mig = (id) => this.book.migrateId(id);
      const merged = { ...clone(def), ...raw, version: this.config.SAVE_VERSION, battle: null };
      merged.owned = [...new Set((Array.isArray(raw.owned) ? raw.owned : def.owned).map(mig).filter(Boolean))];
      if (!merged.owned.length) merged.owned = clone(def.owned);
      merged.party = [...new Set((Array.isArray(raw.party) ? raw.party : def.party).map(mig).filter((id) => id && merged.owned.includes(id)))];
      if (!merged.party.length) merged.party = merged.owned.slice(0, 3);
      merged.inventory = Array.isArray(raw.inventory) ? raw.inventory : [];
      merged.tiers = { ...clone(def.tiers), ...(raw.tiers || {}) };
      merged.equipped = {};
      if (raw.equipped && typeof raw.equipped === "object") {
        for (const [oldId, eq] of Object.entries(raw.equipped)) {
          const id = mig(oldId);
          if (!id || !eq || typeof eq !== "object") continue;
          merged.equipped[id] = { ...(merged.equipped[id] || {}), ...eq };
        }
      }
      merged.progress = {};
      if (raw.progress && typeof raw.progress === "object") {
        for (const [oldId, p] of Object.entries(raw.progress)) {
          const id = mig(oldId);
          if (!id) continue;
          const old = merged.progress[id] || { level: 1, exp: 0 };
          merged.progress[id] = { level: Math.max(old.level, Number(p.level) || 1), exp: Math.max(old.exp, Number(p.exp) || 0) };
        }
      }
      for (const id of merged.owned) merged.progress[id] ||= { level: 1, exp: 0 };
      merged.stage = Math.min(10, Math.max(1, Number(raw.stage) || 1));
      merged.worldClear = Math.max(0, Number(raw.worldClear) || 0);
      merged.unlockedMaps = Math.min(this.data.maps.length, Math.max(1, Number(raw.unlockedMaps) || 1));
      merged.currentMap = this.book.map[raw.currentMap] ? raw.currentMap : "slime";
      merged.speed = [1, 2, 5].includes(raw.speed) ? raw.speed : 1;
      merged.running = raw.running !== false;
      merged.gold = Math.max(0, Number(raw.gold) || 0);
      merged.essence = Math.max(0, Number(raw.essence) || 0);
      merged.mineralEssence = Math.max(0, Number(raw.mineralEssence) || 0);
      return merged;
    } catch (err) {
      console.warn("存檔遷移失敗，使用預設存檔。", err);
      return def;
    }
  }

  persist(state) {
    state.version = this.config.SAVE_VERSION;
    const copy = { ...state, battle: null };
    localStorage.setItem(this.config.SAVE_KEY, JSON.stringify(copy));
  }

  wipe() {
    localStorage.removeItem(this.config.SAVE_KEY);
  }
}
