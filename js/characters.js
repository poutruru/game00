/* CharacterBook：角色＝職業（種族設定保留於 GAME_DATA.races，遊戲中不顯示、不使用）。 */
class CharacterBook {
  constructor(data) {
    this.data = data;
    this.job = Object.fromEntries(data.jobs.map((x) => [x.id, x]));
    this.map = Object.fromEntries(data.maps.map((x) => [x.id, x]));
    this.all = data.jobs.map((j) => ({ id: j.id, job: j.id }));
  }

  get(id) {
    return this.job[id] ? { id, job: id } : undefined;
  }

  isValid(id) {
    return !!this.job[id];
  }

  /* 舊存檔角色 ID 遷移：race_job → job */
  migrateId(id) {
    if (this.isValid(id)) return id;
    if (typeof id !== "string") return null;
    const parts = id.split("_");
    const candidate = parts[parts.length - 1];
    return this.isValid(candidate) ? candidate : null;
  }

  label(c) {
    return c ? this.job[c.job].name : "未知角色";
  }

  labelOf(id) {
    return this.job[id] ? this.job[id].name : "未知角色";
  }
}
