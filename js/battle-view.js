/* BattleView：戰鬥場景渲染。四排：敵後、敵前、VS、我前、我後。
   所有戰鬥回饋走飄字特效（顏色見 css .dmg.*）；紀錄文字寫入「紀錄」分頁。 */
class BattleView {
  constructor(game) {
    this.game = game;
  }

  get state() { return this.game.state; }

  log(text, cls = "") {
    const el = $("battleLog");
    if (!el) return;
    const d = document.createElement("div");
    d.textContent = text;
    d.className = cls;
    el.appendChild(d);
    while (el.children.length > 300) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  clearLog() {
    $("battleLog").innerHTML = "";
  }

  unitHTML(u, drop, delay) {
    const size = u.side === "ally" ? 48 : u.type === "boss" ? 68 : u.type === "elite" ? 54 : 44;
    const img = u.side === "ally" ? this.game.sprites.img("char", u.key, size) : this.game.sprites.img("enemy", this.state.currentMap, size);
    return `<div class="unit${u.side === "enemy" ? " enemy" : ""}${drop ? " drop" : ""}" id="unit_${u.side}_${u.key}" ${drop ? `style="animation-delay:${delay}ms"` : ""}><div class="ubox">${img}</div><div class="uhp"><div class="ushield"></div><div class="uhpfill" style="width:100%"></div></div><div class="ucast"><div class="ucastfill" style="width:0%"></div></div><div class="uname ${u.type === "boss" ? "purple" : u.type === "elite" ? "gold" : ""}">${u.name}</div></div>`;
  }

  rowHTML(units, drop) {
    return units.map((u, i) => this.unitHTML(u, drop, i * 90)).join("");
  }

  buildRows(b, dropEnemies) {
    $("enemyBackRow").innerHTML = this.rowHTML(b.enemies.filter((e) => e.row === "back"), dropEnemies);
    $("enemyFrontRow").innerHTML = this.rowHTML(b.enemies.filter((e) => e.row === "front"), dropEnemies);
  }

  buildAllyRows(b) {
    $("allyFrontRow").innerHTML = this.rowHTML(b.allies.filter((a) => a.row === "front"), false);
    $("allyBackRow").innerHTML = this.rowHTML(b.allies.filter((a) => a.row === "back"), false);
  }

  rebuildScene() {
    const b = this.state.battle;
    if (!b) return;
    this.buildRows(b, false);
    this.buildAllyRows(b);
  }

  el(u) {
    return $(`unit_${u.side}_${u.key}`);
  }

  updateUnit(b, u) {
    const el = this.el(u);
    if (!el) return;
    el.classList.toggle("dead", !u.alive || u.hp <= 0);
    el.querySelector(".uhpfill").style.width = (u.alive ? Math.max(0, (100 * u.hp) / u.maxHp) : 0) + "%";
    /* 護盾：血條上的半透明白色覆蓋 */
    const sh = el.querySelector(".ushield");
    sh.style.width = u.shield > 0 ? Math.min(100, (100 * u.shield) / u.maxHp) + "%" : "0%";
    /* 詠唱條 */
    const cast = el.querySelector(".ucastfill");
    if (u.casting && u.alive) {
      const progress = 1 - (u.casting.until - b.time) / u.casting.dur;
      cast.parentElement.style.visibility = "visible";
      cast.style.width = Math.max(0, Math.min(100, progress * 100)) + "%";
    } else {
      cast.parentElement.style.visibility = "hidden";
      cast.style.width = "0%";
    }
  }

  fxAttack(u) {
    const el = this.el(u);
    if (!el) return;
    el.classList.remove("atk");
    void el.offsetWidth;
    el.classList.add("atk");
    setTimeout(() => el.classList.remove("atk"), 330);
    const art = u.side === "ally" ? this.game.sprites.attackFrames(u.key) : null;
    if (art) {
      const img = el.querySelector("img");
      if (!img) return;
      if (el._frameTimers) el._frameTimers.forEach(clearTimeout);
      el._frameTimers = art.atk.map((src, i) => setTimeout(() => { img.src = src; }, i * 85));
      el._frameTimers.push(setTimeout(() => { img.src = art.idle; }, art.atk.length * 85 + 90));
    }
  }

  fxPop(u, text, cls) {
    const el = this.el(u);
    if (!el) return;
    const d = document.createElement("div");
    d.className = "dmg " + cls;
    d.textContent = text;
    el.appendChild(d);
    setTimeout(() => d.remove(), 760);
  }

  fxHit(u, value, cls) {
    const el = this.el(u);
    if (!el) return;
    el.classList.remove("hit");
    void el.offsetWidth;
    el.classList.add("hit");
    setTimeout(() => el.classList.remove("hit"), 310);
    this.fxPop(u, "-" + value, cls || "hurt");
  }

  render() {
    const scene = $("battleScene");
    const b = this.state.battle;
    const engine = this.game.battle;
    if (!b) {
      if (!engine.smoothNext) {
        scene.dataset.token = "";
        scene.dataset.allyKey = "";
        $("enemyFrontRow").innerHTML = `<div class="small" style="align-self:center">準備下一場戰鬥…</div>`;
        $("enemyBackRow").innerHTML = "";
        $("allyFrontRow").innerHTML = "";
        $("allyBackRow").innerHTML = "";
      }
      return;
    }
    if (scene.dataset.token !== b.token) {
      const allyKey = b.allies.map((a) => a.key + a.row).join(",");
      if (engine.smoothNext && scene.dataset.allyKey === allyKey && ($("allyFrontRow").children.length || $("allyBackRow").children.length)) {
        this.buildRows(b, true);
      } else {
        this.buildRows(b, false);
        this.buildAllyRows(b);
      }
      scene.dataset.token = b.token;
      scene.dataset.allyKey = allyKey;
      engine.smoothNext = false;
    }
    for (const e of b.enemies) this.updateUnit(b, e);
    for (const a of b.allies) this.updateUnit(b, a);
  }
}
