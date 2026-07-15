/* SaveManager：localStorage 存檔的載入、驗證遷移、寫入與世代重置。
   v0.18 大改版採「自動遷移」不重置：舊的 race_job 角色轉為職業、各角色等級轉為隊伍等級（取最高）。 */
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
      teamLevel: 1,
      teamExp: 0,
      unlockedJobs: ["warrior", "mage", "priest"],
      /* 陣型：6 格（0-2 前排、3-5 後排），可同時上陣人數隨周目提升（見 CONFIG.fieldCap） */
      formation: [null, "warrior", null, "mage", null, "priest"],
      inventory: [],
      equipped: {},
      battle: null,
    };
  }

  load() {
    const def = this.defaultState();
    try {
      const raw = JSON.parse(localStorage.getItem(this.config.SAVE_KEY) || "{}");
      if (!Object.keys(raw).length) return def;
      if ((Number(raw.version) || 0) < this.config.WIPE_BELOW_VERSION) {
        console.warn("存檔世代過舊，全員重置。");
        localStorage.removeItem(this.config.SAVE_KEY);
        return def;
      }
      const mig = (id) => this.book.migrateId(id);
      const merged = { ...clone(def), ...raw, version: this.config.SAVE_VERSION, battle: null };

      /* 進度數值 */
      merged.stage = Math.min(10, Math.max(1, Number(raw.stage) || 1));
      merged.worldClear = Math.max(0, Number(raw.worldClear) || 0);
      merged.unlockedMaps = Math.min(this.data.maps.length, Math.max(1, Number(raw.unlockedMaps) || 1));
      merged.currentMap = this.book.map[raw.currentMap] ? raw.currentMap : "slime";
      merged.speed = [1, 2, 5].includes(raw.speed) ? raw.speed : 1;
      merged.running = raw.running !== false;
      merged.gold = Math.max(0, Number(raw.gold) || 0);
      merged.essence = Math.max(0, Number(raw.essence) || 0);
      merged.mineralEssence = Math.max(0, Number(raw.mineralEssence) || 0);
      merged.tiers = { ...clone(def.tiers), ...(raw.tiers || {}) };

      /* 隊伍等級：新檔直接讀；舊檔（每角色等級制）取最高角色等級 */
      if (Number(raw.teamLevel) >= 1) {
        merged.teamLevel = Math.floor(Number(raw.teamLevel));
        merged.teamExp = Math.max(0, Number(raw.teamExp) || 0);
      } else if (raw.progress && typeof raw.progress === "object") {
        merged.teamLevel = Math.max(1, ...Object.values(raw.progress).map((p) => Number(p.level) || 1));
        merged.teamExp = 0;
      }

      /* 職業解鎖：讀取有效清單，並依進度補發（防呆＋舊檔遷移） */
      const jobsFromSave = Array.isArray(raw.unlockedJobs) ? raw.unlockedJobs.map(mig).filter(Boolean) : [];
      const jobsFromOwned = Array.isArray(raw.owned) ? raw.owned.map(mig).filter(Boolean) : [];
      const unlocked = new Set([...def.unlockedJobs, ...jobsFromSave, ...jobsFromOwned]);
      if (merged.worldClear >= 1 || merged.unlockedMaps >= 6) unlocked.add("hunter");
      if (merged.worldClear >= 1) unlocked.add("rogue");
      if (merged.worldClear >= 2) unlocked.add("paladin");
      if (merged.worldClear >= 3) unlocked.add("shaman");
      merged.unlockedJobs = [...unlocked].filter((id) => this.book.isValid(id));

      /* 陣型：新檔直接讀；舊檔由 party 轉換（前排塞滿再塞後排） */
      let formation = Array.isArray(raw.formation) && raw.formation.length === 6
        ? raw.formation.map((id) => (id && this.book.isValid(mig(id)) && merged.unlockedJobs.includes(mig(id)) ? mig(id) : null))
        : null;
      if (!formation) {
        formation = [null, null, null, null, null, null];
        const party = [...new Set((Array.isArray(raw.party) ? raw.party : []).map(mig).filter((id) => id && merged.unlockedJobs.includes(id)))];
        party.slice(0, 6).forEach((id, i) => { formation[i] = id; });
      }
      /* 去重（同職業只能上陣一名） */
      const seen = new Set();
      formation = formation.map((id) => (id && !seen.has(id) ? (seen.add(id), id) : null));
      if (!formation.some(Boolean)) formation = clone(def.formation);
      merged.formation = formation;

      /* 裝備：補上等級與洗練次數；穿戴表遷移角色 ID */
      merged.inventory = (Array.isArray(raw.inventory) ? raw.inventory : []).map((it) => ({ level: 1, rerolls: 0, ...it }));
      merged.equipped = {};
      if (raw.equipped && typeof raw.equipped === "object") {
        for (const [oldId, eq] of Object.entries(raw.equipped)) {
          const id = mig(oldId);
          if (!id || !eq || typeof eq !== "object" || merged.equipped[id]) continue;
          merged.equipped[id] = { ...eq };
        }
      }
      delete merged.owned;
      delete merged.party;
      delete merged.progress;
      delete merged.heroSlot;
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
