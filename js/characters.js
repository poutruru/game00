/* CharacterBook：靜態角色資料的索引與查詢（種族×職業組合、名稱、ID 遷移）。不碰玩家狀態。 */
class CharacterBook {
  constructor(data, hiddenJobs) {
    this.data = data;
    this.job = Object.fromEntries(data.jobs.map((x) => [x.id, x]));
    this.race = Object.fromEntries(data.races.map((x) => [x.id, x]));
    this.map = Object.fromEntries(data.maps.map((x) => [x.id, x]));
    this.all = [];
    for (const race of data.races) {
      for (const job of data.jobs) {
        if (hiddenJobs.includes(job.id)) continue;
        this.all.push({ id: `${race.id}_${job.id}`, race: race.id, job: job.id });
      }
    }
  }

  get(id) {
    return this.all.find((c) => c.id === id);
  }

  isValid(id) {
    return this.all.some((c) => c.id === id);
  }

  /* 舊存檔的角色 ID 遷移：無效 ID 嘗試取前兩段，仍無效則淘汰（回傳 null） */
  migrateId(id) {
    if (this.isValid(id)) return id;
    if (typeof id !== "string") return null;
    const candidate = id.split("_").slice(0, 2).join("_");
    return this.isValid(candidate) ? candidate : null;
  }

  label(c) {
    return c ? `${this.race[c.race].name}-${this.job[c.job].name}` : "未知角色";
  }

  labelOf(id) {
    return this.label(this.get(id));
  }
}
