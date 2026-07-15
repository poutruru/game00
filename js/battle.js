/* BattleEngine：即時制自動戰鬥核心（每 tick 0.5 秒）。
   - 雙排陣型：front/back，普攻優先打前排（盜賊優先後排）
   - 技能：玩家瞬發；菁英/Boss 詠唱 1 秒，詠唱可被控制效果打斷，打斷後下一動只能普攻
   - 狀態效果：燃燒/毒素(DoT)、冰凍(減速)、凍結/暈眩(全停)、沉默(禁技能)、護盾(吸收+免疫一次控制)、攻防增減益
   - 關卡：小怪關(5小怪)、每5關菁英關(菁英+5小怪)、每10關Boss關（4種配置依地圖輪換）
   - 隊伍等級：擊殺獲得經驗，全隊共用 */
class BattleEngine {
  constructor(game) {
    this.game = game;
    this.smoothNext = false; /* 勝利無人陣亡→下一場敵人從天而降，不重建我方 */
  }

  get state() { return this.game.state; }
  get book() { return this.game.book; }
  get view() { return this.game.view; }

  /* ---------- 敵人生成 ---------- */

  createEnemy(name, type, index, map, tier, row, opts = {}) {
    const mapIndex = this.book.data.maps.indexOf(map);
    const scale = (1 + (this.state.stage - 1) * 0.105) * (1 + (tier - 1) * 0.30);
    const hpMul = { normal: 2.2, elite: 5, boss: 12 }[type];
    const atkMul = { normal: 1, elite: 1.4, boss: 1.8 }[type];
    const u = {
      key: `${type}_${index}`, side: "enemy", row, name, type,
      maxHp: Math.round((75 + mapIndex * 48) * scale * hpMul), hp: 0,
      atk: Math.round((13 + mapIndex * 5.5) * scale * atkMul),
      def: Math.round((3 + mapIndex * 4.2) * scale * ({ normal: 1, elite: 1.4, boss: 1.8 }[type])),
      crit: 0.05, critDmg: 1.5, aspd: { normal: 0.55, elite: 0.5, boss: 0.45 }[type], cdr: 1,
      attack: opts.heal ? "heal" : "damage",
      skills: (opts.skills || []).map((id) => ({ id, cd: SKILLS[id].cd })),
      effects: [], shield: 0, shieldUntil: 0, shieldBlock: 0,
      atkTimer: 0, autoCount: 0, casting: null, controlUntil: 0, silenceUntil: 0,
      mustAuto: false, tauntBy: null, alive: true, cheated: false,
    };
    u.hp = u.maxHp;
    return u;
  }

  /* Boss 關 4 種配置，依地圖序輪換 */
  bossConfig(mapIndex) {
    return [
      { elites: 2, normals: 0 },
      { elites: 0, normals: 4 },
      { elites: 2, normals: 4 },
      { elites: 0, normals: 0 },
    ][mapIndex % 4];
  }

  buildEnemies(map, tier) {
    const mapIndex = this.book.data.maps.indexOf(map);
    const stage = this.state.stage;
    const list = [];
    const addNormals = (n, heal) => {
      for (let i = 0; i < n; i++) list.push(this.createEnemy(`${map.normal} ${"ABCDE"[i]}`, "normal", i + 1, map, tier, i < 3 ? "front" : "back", heal ? { heal: true } : {}));
    };
    if (stage === 10) {
      const cfg = this.bossConfig(mapIndex);
      addNormals(cfg.normals, true); /* Boss 關的小怪是治療手 */
      for (let i = 0; i < cfg.elites; i++) list.push(this.createEnemy(`${map.elite} ${i + 1}`, "elite", 6 + i, map, tier, "front", { skills: ["eliteSmash"] }));
      const bossSkill = ["bossNova", "bossSmash", "bossNova", "bossShield"][mapIndex % 4];
      list.push(this.createEnemy(map.boss, "boss", 9, map, tier, "back", { skills: [bossSkill] }));
    } else if (stage === 5) {
      addNormals(5, false);
      list.push(this.createEnemy(map.elite, "elite", 6, map, tier, "back", { skills: ["eliteSmash"] }));
    } else {
      addNormals(5, false);
    }
    return list;
  }

  newBattle() {
    const map = this.book.map[this.state.currentMap];
    const tier = this.state.tiers[this.state.currentMap];
    const enemies = this.buildEnemies(map, tier);
    const allies = this.game.stats.partyIds().map((id) => {
      const c = this.book.get(id);
      const s = this.game.stats.effectiveStats(c);
      const j = this.book.job[id];
      return {
        key: id, side: "ally", row: this.game.stats.rowOf(id), name: j.name, job: id,
        ...s, hp: s.maxHp, attack: j.attack,
        skills: j.skills.map((sid) => ({ id: sid, cd: SKILLS[sid].cd * 0.5 })), /* 開場半 CD，避免同時炸開 */
        effects: [], shield: 0, shieldUntil: 0, shieldBlock: 0,
        atkTimer: 0, autoCount: 0, casting: null, controlUntil: 0, silenceUntil: 0,
        mustAuto: false, tauntBy: null, alive: true, cheated: false,
      };
    });
    this.state.battle = { enemies, allies, time: 0, token: Math.random().toString(36).slice(2) };
    this.view.log(`${this.state.stage === 10 ? "Boss" : this.state.stage === 5 ? "菁英" : "普通"}戰開始（${map.name} ${this.state.stage}/10）。`, "system");
  }

  /* ---------- 查詢 ---------- */

  living(units) { return units.filter((u) => u.alive && u.hp > 0); }
  livingEnemies(b) { return this.living(b.enemies); }
  livingAllies(b) { return this.living(b.allies); }
  foesOf(b, u) { return u.side === "ally" ? this.livingEnemies(b) : this.livingAllies(b); }
  matesOf(b, u) { return u.side === "ally" ? this.livingAllies(b) : this.livingEnemies(b); }

  hasEffect(u, id) { return u.effects.some((e) => e.id === id); }
  chillFactor(u) { return this.hasEffect(u, "chill") ? 1 - EFFECTS.chill.ratio : 1; }

  /* 增減益後的素質 */
  effStat(u, stat) {
    let v = u[stat];
    for (const e of u.effects) if (e.stat === stat) v *= 1 + (e.buff ? e.ratio : -e.ratio);
    if (stat === "atk") {
      if (u.job === "warrior") v *= 1 + Math.min(0.35, 0.35 * (1 - u.hp / u.maxHp));
      if (u.job === "shaman") v *= 1 + Math.min(0.60, 0.02 * (this.state.battle ? this.state.battle.time : 0));
    }
    return v;
  }

  /* 普攻目標：前排優先（盜賊/後排指定除外）；嘲諷強制 */
  pickAutoTarget(b, u) {
    const foes = this.foesOf(b, u);
    if (!foes.length) return null;
    if (u.side === "enemy" && u.tauntBy) {
      const t = this.livingAllies(b).find((x) => x.key === u.tauntBy);
      u.tauntBy = null;
      if (t) return t;
    }
    const preferBack = u.job === "rogue";
    const front = foes.filter((x) => x.row === "front");
    const back = foes.filter((x) => x.row === "back");
    const pool = preferBack ? (back.length ? back : front) : (front.length ? front : back);
    return rand(pool);
  }

  /* ---------- 傷害 / 治療 / 效果 ---------- */

  dealDamage(b, att, target, raw, { canCrit = true, popCls = null } = {}) {
    let value = raw;
    let crit = false;
    if (canCrit && Math.random() < (att ? this.effStat(att, "crit") : 0)) {
      crit = true;
      value *= att ? att.critDmg : 1.5;
    }
    value = Math.max(1, Math.round(value - this.effStat(target, "def") * 0.5));
    /* 護盾吸收 */
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, value);
      target.shield -= absorbed;
      value -= absorbed;
    }
    /* 牧師被動：抵銷第一次致命傷害 */
    if (value >= target.hp && target.job === "priest" && !target.cheated) {
      target.cheated = true;
      this.view.fxPop(target, "抵銷！", "block");
      return 0;
    }
    target.hp = Math.max(0, target.hp - value);
    this.view.fxHit(target, value, popCls || (crit ? "crit" : "hurt"));
    if (target.hp <= 0 && target.alive) this.kill(b, target);
    return value;
  }

  heal(b, healer, target, amount) {
    if (!target.alive) return;
    const v = Math.round(amount);
    target.hp = Math.min(target.maxHp, target.hp + v);
    this.view.fxPop(target, "+" + v, "heal");
  }

  applyEffect(b, src, target, effectId, duration) {
    const def = EFFECTS[effectId];
    const t = b.time;
    if (def.kind === "control") {
      /* 護盾免疫一次控制 */
      if (target.shieldBlock > 0 && target.shieldUntil > t) {
        target.shieldBlock--;
        this.view.fxPop(target, "免疫", "block");
        return;
      }
      if (target.casting) {
        target.casting = null;
        target.mustAuto = true; /* 詠唱被打斷 → 下一動只能普攻 */
        this.view.fxPop(target, "打斷！", "interrupt");
      }
      if (def.stop === "all") target.controlUntil = Math.max(target.controlUntil, t + duration);
      else target.silenceUntil = Math.max(target.silenceUntil, t + duration);
      this.view.fxPop(target, def.name, "control");
      return;
    }
    if (def.kind === "shield") {
      target.shield = Math.round(target.maxHp * def.ratio);
      target.shieldUntil = t + def.duration;
      target.shieldBlock = def.blockControl;
      this.view.fxPop(target, "護盾", "block");
      return;
    }
    /* dot / slow / buff / debuff：同種效果刷新（不疊加） */
    target.effects = target.effects.filter((e) => e.id !== effectId);
    const entry = { id: effectId, until: t + (duration || def.duration), color: def.color };
    if (def.kind === "dot") { entry.dot = true; entry.tickBase = def.tick; entry.ratio = def.ratio; entry.srcAtk = src ? this.effStat(src, "atk") : 0; entry.nextTick = t + 1; }
    if (def.kind === "slow") entry.slow = true;
    if (def.kind === "buff") { entry.buff = true; entry.stat = def.stat; entry.ratio = def.ratio; }
    if (def.kind === "debuff") { entry.stat = def.stat; entry.ratio = def.ratio; }
    target.effects.push(entry);
  }

  tickEffects(b, u) {
    const t = b.time;
    for (const e of u.effects) {
      if (e.hot && t >= e.nextTick) { this.heal(b, null, u, e.amount); e.nextTick += 1; }
      if (e.dot && t >= e.nextTick) {
        e.nextTick += 1;
        let value = Math.max(1, Math.round(e.tickBase === "atk" ? e.srcAtk * e.ratio : u.maxHp * e.ratio));
        if (u.shield > 0) { const absorbed = Math.min(u.shield, value); u.shield -= absorbed; value -= absorbed; }
        u.hp = Math.max(0, u.hp - value);
        this.view.fxPop(u, "-" + value, e.color);
        if (u.hp <= 0 && u.alive) this.kill(b, u);
      }
    }
    if (u.shieldUntil <= t) u.shield = 0;
    u.effects = u.effects.filter((e) => e.until > t);
  }

  kill(b, u) {
    u.alive = false;
    u.casting = null;
    this.view.log(`${u.name} 倒下。`, "death");
    if (u.side === "enemy") this.grantExp(this.enemyExp(u));
  }

  /* ---------- 技能執行 ---------- */

  execSkill(b, u, skillId) {
    const def = SKILLS[skillId];
    const foes = this.foesOf(b, u);
    const mates = this.matesOf(b, u);
    const atk = this.effStat(u, "atk");
    this.view.fxAttack(u);
    this.view.fxPop(u, def.name, "skillname");
    const applyOnHit = (target) => { if (def.effect) this.applyEffect(b, u, target, def.effect, def.duration); };
    const targetsFor = () => {
      if (def.target === "enemies") return [...foes];
      if (def.target === "row") { const rows = ["front", "back"].map((r) => foes.filter((f) => f.row === r)).filter((g) => g.length); return rows.length ? rand(rows) : []; }
      if (def.target === "backRow") { const back = foes.filter((f) => f.row === "back"); return back.length ? back : foes.filter((f) => f.row === "front"); }
      if (def.target === "enemy") { const t = this.pickAutoTarget(b, u); return t ? [t] : []; }
      return [];
    };
    switch (def.type) {
      case "damage":
        for (const t of targetsFor()) { this.dealDamage(b, u, t, atk * def.mult); if (t.alive) applyOnHit(t); }
        break;
      case "control":
        for (const t of (def.target === "enemy" ? targetsFor() : [...foes])) this.applyEffect(b, u, t, def.effect, def.duration);
        break;
      case "buff":
        for (const t of mates) this.applyEffect(b, u, t, def.effect, def.duration);
        break;
      case "heal": {
        if (def.target === "allies") for (const t of mates) this.heal(b, u, t, atk * def.mult);
        else { const t = [...mates].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; if (t) this.heal(b, u, t, atk * def.mult); }
        break;
      }
      case "hot":
        for (const t of mates) {
          t.effects = t.effects.filter((e) => e.id !== "hot_" + skillId);
          t.effects.push({ id: "hot_" + skillId, hot: true, amount: Math.round(atk * def.mult), until: b.time + def.duration, nextTick: b.time + 1 });
        }
        break;
      case "revive": {
        const dead = (u.side === "ally" ? b.allies : b.enemies).find((x) => !x.alive);
        if (dead) { dead.alive = true; dead.hp = Math.round(dead.maxHp * 0.6); dead.effects = []; dead.controlUntil = 0; this.view.fxPop(dead, "復活！", "heal"); this.view.log(`${u.name} 復活了 ${dead.name}！`, "heal"); this.game.view.rebuildScene(); }
        else { const t = [...mates].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; if (t) this.heal(b, u, t, t.maxHp - t.hp); }
        break;
      }
      case "shield":
        this.applyEffect(b, u, u, "shield");
        break;
    }
    this.view.log(`${u.name} 使用「${def.name}」。`, u.side === "ally" ? "skill" : "damage");
  }

  /* ---------- 普攻 ---------- */

  autoAttack(b, u) {
    u.autoCount++;
    this.view.fxAttack(u);
    if (u.attack === "heal") {
      const mates = this.matesOf(b, u);
      const t = [...mates].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
      if (t) this.heal(b, u, t, this.effStat(u, "atk") * 1.2);
      return;
    }
    const target = this.pickAutoTarget(b, u);
    if (!target) return;
    this.dealDamage(b, u, target, this.effStat(u, "atk"));
    if (!target.alive) return;
    if (u.job === "mage") this.applyEffect(b, u, target, "burn");
    if (u.job === "paladin") { this.applyEffect(b, u, target, "atkDown", 4); target.tauntBy = u.key; }
  }

  /* ---------- 單位行動（每 tick） ---------- */

  tickUnit(b, u) {
    const t = b.time;
    const chill = this.chillFactor(u);
    if (u.controlUntil > t) return; /* 暈眩/凍結：完全停止 */
    /* 詠唱中：時間到才施放 */
    if (u.casting) {
      if (t >= u.casting.until) { const id = u.casting.skill; u.casting = null; this.execSkill(b, u, id); }
      return;
    }
    /* CD 推進（冰凍會變慢） */
    for (const sk of u.skills) sk.cd = Math.max(0, sk.cd - 0.5 * chill * u.cdr);
    /* 嘗試施放技能（被打斷過→本次只能普攻；沉默中不可用技能） */
    if (!u.mustAuto && u.silenceUntil <= t) {
      const ready = u.skills.find((s) => s.cd <= 0);
      if (ready) {
        const def = SKILLS[ready.id];
        ready.cd = def.cd;
        if (def.cast > 0) { u.casting = { skill: ready.id, until: t + def.cast / chill, dur: def.cast / chill }; this.view.log(`${u.name} 開始詠唱「${def.name}」…`, "system"); }
        else this.execSkill(b, u, ready.id);
        return;
      }
    }
    /* 普攻計時（獵人被動加速） */
    const haste = u.job === "hunter" ? 1 + Math.min(0.6, (u.autoCount || 0) * 0.06) : 1;
    u.atkTimer += 0.5 * u.aspd * chill * haste;
    if (u.atkTimer >= 1) { u.atkTimer = 0; u.mustAuto = false; this.autoAttack(b, u); }
  }

  /* ---------- 主迴圈 ---------- */

  step() {
    if (!this.state.running) return;
    if (!this.state.battle) this.newBattle();
    const b = this.state.battle;
    b.time += 0.5;
    for (const u of [...this.livingAllies(b), ...this.livingEnemies(b)]) this.tickEffects(b, u);
    if (this.checkEnd(b)) return;
    for (const u of this.livingAllies(b)) { this.tickUnit(b, u); if (this.checkEnd(b)) return; }
    for (const u of this.livingEnemies(b)) { this.tickUnit(b, u); if (this.checkEnd(b)) return; }
    this.view.render();
  }

  checkEnd(b) {
    if (!this.livingEnemies(b).length) { this.winBattle(); return true; }
    if (!this.livingAllies(b).length) { this.loseBattle(); return true; }
    return false;
  }

  /* ---------- 經驗 / 勝負 / 進程 ---------- */

  enemyExp(enemy) {
    const mapIndex = this.book.data.maps.findIndex((m) => m.id === this.state.currentMap);
    const tier = this.state.tiers[this.state.currentMap];
    const mul = enemy.type === "boss" ? 10 : enemy.type === "elite" ? 3 : 1;
    return Math.round((8 + mapIndex * 4 + tier * 3) * mul);
  }

  grantExp(amount) {
    const st = this.state, stats = this.game.stats;
    st.teamExp += amount;
    while (st.teamExp >= stats.expNeeded(st.teamLevel)) {
      st.teamExp -= stats.expNeeded(st.teamLevel);
      st.teamLevel++;
      this.view.log(`隊伍升級！Lv.${st.teamLevel}`, "system");
    }
  }

  winBattle() {
    this.smoothNext = !!this.state.battle && this.state.battle.allies.every((a) => a.alive);
    const map = this.book.map[this.state.currentMap];
    const tier = this.state.tiers[this.state.currentMap];
    const mapIndex = this.book.data.maps.findIndex((m) => m.id === this.state.currentMap);
    const money = 22 + mapIndex * 12 + tier * 8 + this.state.stage * 3;
    this.state.gold += money;
    this.view.log(`關卡勝利，獲得 ${money} 金幣。`, "drop");
    this.game.equipment.rollDrop(map, tier);
    if (this.state.stage < 10) {
      this.state.stage++;
    } else {
      this.state.tiers[this.state.currentMap]++;
      if (mapIndex === 4) this.game.ui.unlockJob("hunter"); /* 第5張地圖Boss首殺 → 獵人 */
      if (mapIndex < this.book.data.maps.length - 1) {
        this.state.unlockedMaps = Math.max(this.state.unlockedMaps, mapIndex + 2);
        this.state.currentMap = this.book.data.maps[mapIndex + 1].id;
        this.state.stage = 1;
        this.view.log(`擊敗 ${map.boss}，前往 ${this.book.data.maps[mapIndex + 1].name}。`, "system");
      } else {
        this.state.worldClear++;
        this.state.currentMap = this.book.data.maps[0].id;
        this.state.stage = 1;
        this.view.log(`完成第 ${this.state.worldClear} 周目！`, "system");
        if (this.state.worldClear === 1) { this.game.ui.unlockJob("rogue"); this.game.ui.showInfo("周目獎勵", ["可上陣人數 +1（現在可上 4 人）！"]); }
        else if (this.state.worldClear === 2) { this.game.ui.unlockJob("paladin"); this.game.ui.showInfo("周目獎勵", ["可上陣人數 +1（現在可上 5 人）！"]); }
        else if (this.state.worldClear === 3) { this.game.ui.unlockJob("shaman"); this.state.essence += 5; this.game.ui.showInfo("周目獎勵", ["獲得英雄精華 ×5（目前尚無用途，之後開放）。"]); }
        else { this.state.essence += 5; this.view.log("獲得英雄精華 ×5（目前尚無用途）。", "drop"); }
      }
    }
    this.state.battle = null;
    this.game.persist();
    this.game.ui.renderAll();
    setTimeout(() => this.newBattle(), 450);
  }

  loseBattle() {
    this.smoothNext = false;
    const old = this.state.stage;
    this.state.stage = Math.max(1, this.state.stage - 1);
    this.state.battle = null;
    this.view.log(`隊伍全滅：關卡 ${old} → ${this.state.stage}。`, "death");
    this.game.persist();
    this.game.ui.renderAll();
    setTimeout(() => this.newBattle(), 750);
  }
}
