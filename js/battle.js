/* BattleEngine：自動戰鬥核心——敵人生成、回合推進、技能/絕技、勝負與獎勵。
   畫面（場景 DOM、特效、紀錄文字）透過 game.view 呈現。 */
class BattleEngine {
  constructor(game) {
    this.game = game;
    /* 勝利且無人陣亡時，下一場用「敵人從天而降」的絲滑過場（不重建我方） */
    this.smoothNext = false;
  }

  get state() {
    return this.game.state;
  }

  get book() {
    return this.game.book;
  }

  get view() {
    return this.game.view;
  }

  createEnemy(name, type, index, map, tier) {
    const mapIndex = this.book.data.maps.indexOf(map);
    const base = 75 + mapIndex * 48;
    const stageScale = 1 + (this.state.stage - 1) * 0.105;
    const tierScale = 1 + (tier - 1) * 0.30;
    const hpMul = { normal: 2.2, elite: 4.5, boss: 10 }[type];
    const atkMul = { normal: 1, elite: 1.35, boss: 1.75 }[type];
    const defMul = { normal: 1, elite: 1.4, boss: 1.8 }[type];
    const scale = stageScale * tierScale;
    const enemy = {
      id: `${type}_${index}`,
      name,
      type,
      maxHp: Math.round(base * scale * hpMul),
      hp: 0,
      atk: Math.round((13 + mapIndex * 5.5) * scale * atkMul),
      def: Math.round((3 + mapIndex * 4.2) * scale * defMul),
      turn: 0,
      alive: true,
    };
    enemy.hp = enemy.maxHp;
    return enemy;
  }

  /* 普通關 5 小怪；第 5 關 +菁英；第 10 關 3 小怪+菁英+Boss */
  newBattle() {
    const map = this.book.map[this.state.currentMap];
    const tier = this.state.tiers[this.state.currentMap];
    const normalCount = this.state.stage === 10 ? 3 : 5;
    const enemies = ["A", "B", "C", "D", "E"].slice(0, normalCount).map((letter, i) => this.createEnemy(`${map.normal} ${letter}`, "normal", i + 1, map, tier));
    if (this.state.stage === 5) enemies.push(this.createEnemy(map.elite, "elite", 6, map, tier));
    if (this.state.stage === 10) {
      enemies.push(this.createEnemy(map.elite, "elite", 6, map, tier));
      enemies.push(this.createEnemy(map.boss, "boss", 7, map, tier));
    }
    const allies = this.state.party
      .map((id) => this.book.get(id))
      .filter(Boolean)
      .map((c) => {
        const s = this.game.stats.effectiveStats(c);
        return { id: c.id, job: c.job, ...s, hp: s.maxHp, charge: 0, cd: 0, turn: 0, alive: true };
      });
    this.state.battle = { enemies, allies, time: 0, token: Math.random().toString(36).slice(2) };
    this.view.log(`${this.state.stage === 10 ? "Boss" : this.state.stage === 5 ? "菁英" : "普通"}戰開始：${enemies.map((e) => e.name).join("、")}。`, "system");
  }

  livingEnemies(b) {
    return b.enemies.filter((e) => e.alive && e.hp > 0);
  }

  chooseEnemy(b) {
    return rand(this.livingEnemies(b));
  }

  damage(target, raw) {
    const value = Math.max(1, Math.round(raw - target.def * 0.45));
    target.hp = Math.max(0, target.hp - value);
    return value;
  }

  enemyExp(enemy) {
    const mapIndex = this.book.data.maps.findIndex((m) => m.id === this.state.currentMap);
    const tier = this.state.tiers[this.state.currentMap];
    const mul = enemy.type === "boss" ? 8 : enemy.type === "elite" ? 3 : 1;
    return Math.round((8 + mapIndex * 4 + tier * 3) * mul);
  }

  grantExp(amount) {
    const stats = this.game.stats;
    for (const id of this.state.party) {
      const p = stats.progressOf(id);
      p.exp += amount;
      while (p.exp >= stats.expNeeded(p.level)) {
        p.exp -= stats.expNeeded(p.level);
        p.level++;
        this.view.log(`${this.book.labelOf(id)} 升至 Lv.${p.level}。`, "system");
      }
    }
    this.view.log(`上陣角色各獲得 ${amount} 經驗。`, "drop");
    this.game.persist();
  }

  markEnemyDeath(enemy) {
    if (enemy.hp <= 0 && enemy.alive) {
      enemy.alive = false;
      this.view.log(`${enemy.name} 死亡。`, "death");
      this.grantExp(this.enemyExp(enemy));
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
      if (mapIndex < this.book.data.maps.length - 1) {
        this.state.unlockedMaps = Math.max(this.state.unlockedMaps, mapIndex + 2);
        this.state.currentMap = this.book.data.maps[mapIndex + 1].id;
        this.state.stage = 1;
        this.view.log(`擊敗 ${map.boss}，自動前往 ${this.book.data.maps[mapIndex + 1].name}。`, "system");
      } else {
        this.state.worldClear++;
        this.state.currentMap = this.book.data.maps[0].id;
        this.state.stage = 1;
        this.view.log(`完成第 ${this.state.worldClear} 周目，返回 ${this.book.data.maps[0].name}。`, "system");
        if (this.state.worldClear === 1) this.view.log("解鎖第 4 個隊伍名額。", "system");
        if (this.state.worldClear === 2) this.view.log("解鎖第 5 個隊伍名額。", "system");
        if (this.state.worldClear === 3) this.view.log("英雄槽已解鎖；目前尚無英雄卡池。", "system");
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
    this.view.log(`隊伍全滅：關卡 ${old} → ${this.state.stage}，返回前一關反覆累積經驗。`, "death");
    this.game.persist();
    this.game.ui.renderAll();
    setTimeout(() => this.newBattle(), 750);
  }

  /* 每個計時器 tick 推進 0.5 秒的戰鬥時間 */
  step() {
    if (!this.state.running) return;
    if (!this.state.battle) this.newBattle();
    const b = this.state.battle;
    b.time += 0.5;
    for (const a of b.allies) {
      if (!a.alive) continue;
      a.cd -= 0.5;
      a.turn += a.speed * 0.5;
    }
    const actors = b.allies.filter((a) => a.alive && (a.cd <= 0 || a.turn >= 1));
    if (actors.length && this.livingEnemies(b).length) {
      this.allyAct(b, rand(actors));
    }
    if (!this.livingEnemies(b).length) {
      this.winBattle();
      return;
    }
    for (const e of this.livingEnemies(b)) e.turn += e.type === "boss" ? 0.30 : e.type === "elite" ? 0.38 : 0.48;
    const enemyActors = this.livingEnemies(b).filter((e) => e.turn >= 1);
    if (enemyActors.length) {
      if (!this.enemyAct(b, rand(enemyActors))) return; // 全滅時中斷
    }
    this.view.render();
  }

  /* 我方單位行動：CD 技優先，否則普攻；行動後檢查絕技充能 */
  allyAct(b, a) {
    const stats = this.game.stats, view = this.view;
    const c = this.book.get(a.id);
    const job = this.book.job[c.job];
    const actor = `${this.book.label(c)} Lv.${stats.progressOf(c.id).level}`;
    if (a.cd <= 0) {
      a.cd = stats.cdTimeOf(c.job);
      if (c.job === "priest") {
        const target = b.allies.filter((x) => x.alive).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        const heal = Math.round(a.atk * 2.4);
        target.hp = Math.min(target.maxHp, target.hp + heal);
        a.charge += heal;
        view.fxAttack("ally", a.id);
        view.fxPop("ally", target.id, "+" + heal, "heal");
        view.log(`${actor} 使用「${job.cdSkill}」，${this.book.labelOf(target.id)} 恢復 ${heal} 生命。`, "heal");
      } else if (c.job === "paladin") {
        const heal = Math.round(a.maxHp * 0.12);
        a.hp = Math.min(a.maxHp, a.hp + heal);
        view.fxAttack("ally", a.id);
        view.fxPop("ally", a.id, "+" + heal, "heal");
        view.log(`${actor} 使用「${job.cdSkill}」。`, "skill");
      } else {
        const target = this.chooseEnemy(b);
        const crit = Math.random() < a.crit;
        const value = this.damage(target, a.atk * (c.job === "mage" ? 2.2 : 1.8) * (crit ? 1.7 : 1));
        view.fxAttack("ally", a.id);
        view.fxHit("enemy", target.id, value, crit ? "crit" : "hurt");
        view.log(`${actor} 使用「${job.cdSkill}」，對 ${target.name} 造成 ${value} 傷害${crit ? "（暴擊）" : ""}。`, "skill");
        a.charge++;
        this.markEnemyDeath(target);
      }
    } else {
      a.turn = 0;
      const target = this.chooseEnemy(b);
      const crit = Math.random() < a.crit;
      const value = this.damage(target, a.atk * (crit ? 1.7 : 1));
      view.fxAttack("ally", a.id);
      view.fxHit("enemy", target.id, value, crit ? "crit" : "hurt");
      view.log(`${actor} 普攻 ${target.name}，造成 ${value} 傷害${crit ? "（暴擊）" : ""}。`, "damage");
      a.charge++;
      this.markEnemyDeath(target);
    }
    if (a.charge >= stats.thresholdOf(a) && this.livingEnemies(b).length) {
      a.charge = 0;
      this.triggerSkill(b, a, c, job, actor);
    }
  }

  /* 絕技：牧師全隊治療／聖騎士嘲諷／法師全體暴風雪／其他單體重擊 */
  triggerSkill(b, a, c, job, actor) {
    const view = this.view;
    if (a.job === "priest") {
      view.fxAttack("ally", a.id);
      for (const t of b.allies.filter((x) => x.alive)) {
        const heal = Math.round(a.atk * 1.6);
        t.hp = Math.min(t.maxHp, t.hp + heal);
        view.fxPop("ally", t.id, "+" + heal, "heal");
      }
      view.log(`${actor} 觸發「${job.triggerSkill}」，治療全隊。`, "heal");
    } else if (a.job === "paladin") {
      view.fxAttack("ally", a.id);
      for (const t of this.livingEnemies(b)) t.tauntedBy = a.id;
      view.fxPop("ally", a.id, "嘲諷！", "crit");
      view.log(`${actor} 觸發「${job.triggerSkill}」，嘲諷全體敵人——他們的下一次攻擊都將指向 ${this.book.label(c)}！`, "skill");
    } else if (a.job === "mage") {
      view.fxAttack("ally", a.id);
      let total = 0;
      for (const t of this.livingEnemies(b)) {
        const crit = Math.random() < a.crit;
        const value = this.damage(t, a.atk * 2.2 * (crit ? 1.6 : 1));
        view.fxHit("enemy", t.id, value, crit ? "crit" : "hurt");
        total += value;
        this.markEnemyDeath(t);
      }
      view.log(`${actor} 觸發「${job.triggerSkill}」，暴風雪席捲全體敵人，共造成 ${total} 傷害。`, "skill");
    } else {
      const target = this.chooseEnemy(b);
      const mult = { warrior: 3.2, rogue: 3.5, hunter: 4.5, warlock: 3.4 }[a.job] || 3;
      const crit = a.job === "rogue" || Math.random() < a.crit;
      const value = this.damage(target, a.atk * mult * (crit ? 1.6 : 1));
      view.fxAttack("ally", a.id);
      view.fxHit("enemy", target.id, value, "crit");
      view.log(`${actor} 觸發「${job.triggerSkill}」，對 ${target.name} 造成 ${value} 傷害。`, "skill");
      this.markEnemyDeath(target);
    }
  }

  /* 敵人行動；嘲諷中的敵人強制攻擊嘲諷者（打完解除）。回傳 false 表示我方全滅、戰鬥已結束 */
  enemyAct(b, enemy) {
    const view = this.view;
    enemy.turn = 0;
    const targets = b.allies.filter((x) => x.alive);
    if (!targets.length) {
      this.loseBattle();
      return false;
    }
    let target = null;
    if (enemy.tauntedBy) {
      target = targets.find((x) => x.id === enemy.tauntedBy) || null;
      enemy.tauntedBy = null;
    }
    if (!target) target = rand(targets);
    const value = this.damage(target, enemy.atk);
    target.charge += (target.job === "warrior" || target.job === "paladin") ? 1 : 0;
    view.fxAttack("enemy", enemy.id);
    view.fxHit("ally", target.id, value, "hurt");
    view.log(`${enemy.name} 攻擊 ${this.book.labelOf(target.id)}，造成 ${value} 傷害。`);
    if (target.hp <= 0) {
      target.alive = false;
      view.log(`${this.book.labelOf(target.id)} 死亡。`, "death");
    }
    if (!b.allies.some((x) => x.alive)) {
      this.loseBattle();
      return false;
    }
    return true;
  }
}
