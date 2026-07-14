/* BattleView：戰鬥場景的 DOM 渲染、單位血條/技能條更新、攻擊與受擊特效、戰鬥紀錄。 */
class BattleView {
  constructor(game) {
    this.game = game;
  }

  get state() {
    return this.game.state;
  }

  log(text, cls = "") {
    const el = $("battleLog");
    const d = document.createElement("div");
    d.textContent = text;
    d.className = cls;
    el.appendChild(d);
    while (el.children.length > 220) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  clearLog() {
    $("battleLog").innerHTML = "";
  }

  enemyRowHTML(b, drop) {
    return b.enemies.map((e, i) => {
      const size = e.type === "boss" ? 68 : e.type === "elite" ? 54 : 44;
      return `<div class="unit enemy${drop ? " drop" : ""}" id="unit_enemy_${e.id}" ${drop ? `style="animation-delay:${i * 90}ms"` : ""}><div class="ubox">${this.game.sprites.img("enemy", this.state.currentMap, size)}</div><div class="uhp"><div class="uhpfill" style="width:100%"></div></div><div class="uname ${e.type === "boss" ? "purple" : e.type === "elite" ? "gold" : ""}">${e.name}</div></div>`;
    }).join("");
  }

  allyRowHTML(b) {
    return b.allies.map((a) => {
      return `<div class="unit" id="unit_ally_${a.id}"><div class="ubox">${this.game.sprites.img("char", a.id, 48)}</div><div class="uhp"><div class="uhpfill" style="width:100%"></div></div><div class="usk"><div class="uskfill cd" style="width:100%"></div></div><div class="usk"><div class="uskfill charge" style="width:0%"></div></div><div class="uname">${this.game.book.labelOf(a.id)}</div></div>`;
    }).join("");
  }

  updateUnit(side, u) {
    const el = $(`unit_${side}_${u.id}`);
    if (!el) return;
    el.classList.toggle("dead", !u.alive || u.hp <= 0);
    el.querySelector(".uhpfill").style.width = (u.alive ? Math.max(0, (100 * u.hp) / u.maxHp) : 0) + "%";
    const cdFill = el.querySelector(".uskfill.cd");
    if (cdFill) {
      const stats = this.game.stats;
      cdFill.style.width = (u.alive ? Math.max(0, Math.min(100, 100 * (1 - Math.max(0, u.cd) / stats.cdTimeOf(u.job)))) : 0) + "%";
      el.querySelector(".uskfill.charge").style.width = (u.alive ? Math.max(0, Math.min(100, (100 * u.charge) / stats.thresholdOf(u))) : 0) + "%";
    }
  }

  fxAttack(side, id) {
    const el = $(`unit_${side}_${id}`);
    if (!el) return;
    el.classList.remove("atk");
    void el.offsetWidth;
    el.classList.add("atk");
    setTimeout(() => el.classList.remove("atk"), 330);
    const art = side === "ally" ? this.game.sprites.attackFrames(id) : null;
    if (art) {
      const img = el.querySelector("img");
      if (!img) return;
      if (el._frameTimers) el._frameTimers.forEach(clearTimeout);
      el._frameTimers = art.atk.map((src, i) => setTimeout(() => { img.src = src; }, i * 85));
      el._frameTimers.push(setTimeout(() => { img.src = art.idle; }, art.atk.length * 85 + 90));
    }
  }

  fxPop(side, id, text, cls) {
    const el = $(`unit_${side}_${id}`);
    if (!el) return;
    const d = document.createElement("div");
    d.className = "dmg " + cls;
    d.textContent = text;
    el.appendChild(d);
    setTimeout(() => d.remove(), 720);
  }

  fxHit(side, id, value, cls) {
    const el = $(`unit_${side}_${id}`);
    if (!el) return;
    el.classList.remove("hit");
    void el.offsetWidth;
    el.classList.add("hit");
    setTimeout(() => el.classList.remove("hit"), 310);
    this.fxPop(side, id, "-" + value, cls || "hurt");
  }

  /* 場景渲染：戰鬥 token 變更時重建；絲滑過場只重建敵方列（帶落下動畫） */
  render() {
    const scene = $("battleScene");
    const b = this.state.battle;
    const enemyRow = $("enemyRow");
    const allyRow = $("allyRow");
    const engine = this.game.battle;
    if (!b) {
      if (!engine.smoothNext) {
        scene.dataset.token = "";
        scene.dataset.allyKey = "";
        enemyRow.innerHTML = `<div class="small" style="align-self:center">準備下一場戰鬥…</div>`;
        allyRow.innerHTML = "";
      }
      return;
    }
    if (scene.dataset.token !== b.token) {
      const allyKey = b.allies.map((a) => a.id).join(",");
      if (engine.smoothNext && scene.dataset.allyKey === allyKey && allyRow.children.length) {
        enemyRow.innerHTML = this.enemyRowHTML(b, true);
      } else {
        enemyRow.innerHTML = this.enemyRowHTML(b, false);
        allyRow.innerHTML = this.allyRowHTML(b);
      }
      scene.dataset.token = b.token;
      scene.dataset.allyKey = allyKey;
      engine.smoothNext = false;
    }
    for (const e of b.enemies) this.updateUnit("enemy", e);
    for (const a of b.allies) this.updateUnit("ally", a);
  }
}
