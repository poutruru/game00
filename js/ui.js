/* UIController：六個分頁的渲染與所有玩家操作入口（隊伍、裝備面板、背包、地圖、召募、存檔、更新公告）。
   內嵌 HTML 的 onclick 一律呼叫 game.ui.xxx(...)。 */
class UIController {
  constructor(game) {
    this.game = game;
    /* 純介面狀態（不進存檔）：裝備面板選中的角色/部位、展開詳細的角色 */
    this.equipChar = null;
    this.equipSlot = null;
    this.detailChar = null;
    /* 一鍵整理排序：roster＝已擁有角色（time/race/job/level）、bag＝背包（slot/time） */
    this.rosterSort = "time";
    this.bagSort = "slot";
    /* 背包批量選取：勾選的裝備 id、一鍵選取要包含的部位 */
    this.bagSelected = new Set();
    this.bagPick = { head: true, body: true, feet: true, main: true, off: true };
  }

  get state() {
    return this.game.state;
  }

  get book() {
    return this.game.book;
  }

  get cfg() {
    return this.game.config;
  }

  /* ---------- 事件綁定（啟動時一次） ---------- */

  bindEvents() {
    document.querySelectorAll("nav button").forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll("nav button").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".page").forEach((x) => x.classList.remove("active"));
        button.classList.add("active");
        $(button.dataset.page).classList.add("active");
      };
    });
    $("toggleBtn").onclick = () => {
      this.state.running = !this.state.running;
      this.game.persist();
      this.renderAll();
    };
    $("speedBtn").onclick = () => {
      this.state.speed = this.state.speed === 1 ? 2 : this.state.speed === 2 ? 5 : 1;
      this.game.persist();
      this.game.restartTimer();
      this.renderAll();
    };
    $("summonBtn").onclick = () => this.doSummon();
    $("summon10Btn").onclick = () => this.doSummon10();
    $("essenceBtn").onclick = () => this.doEssenceExchange();
    $("exportBtn").onclick = () => { $("saveText").value = JSON.stringify({ ...this.state, battle: null }, null, 2); };
    $("importBtn").onclick = () => this.importSave();
    $("resetBtn").onclick = () => this.resetSave();
    $("dataPreview").textContent = JSON.stringify(this.book.data, null, 2);
  }

  /* ---------- 隊伍與角色 ---------- */

  toggleParty(id) {
    const index = this.state.party.indexOf(id);
    if (index >= 0) this.state.party.splice(index, 1);
    else if (this.state.party.length < this.game.stats.partySlots()) this.state.party.push(id);
    this.state.battle = null;
    this.game.persist();
    this.renderAll();
  }

  toggleDetail(id) {
    this.detailChar = this.detailChar === id ? null : id;
    this.renderAll();
  }

  /* ---------- 一鍵整理（排序） ---------- */

  setRosterSort(key) {
    this.rosterSort = key;
    this.renderAll();
  }

  setBagSort(key) {
    this.bagSort = key;
    this.renderAll();
  }

  /* 已擁有角色的顯示順序（不改動 state.owned 本身，取得順序永遠可還原） */
  sortedRoster() {
    const ids = [...this.state.owned];
    const raceIdx = Object.fromEntries(this.book.data.races.map((r, i) => [r.id, i]));
    const jobIdx = Object.fromEntries(this.book.data.jobs.map((j, i) => [j.id, i]));
    const level = (id) => this.game.stats.progressOf(id).level;
    const time = (id) => this.state.owned.indexOf(id);
    const c = (id) => this.book.get(id);
    if (this.rosterSort === "race") ids.sort((a, b) => raceIdx[c(a).race] - raceIdx[c(b).race] || jobIdx[c(a).job] - jobIdx[c(b).job]);
    else if (this.rosterSort === "job") ids.sort((a, b) => jobIdx[c(a).job] - jobIdx[c(b).job] || raceIdx[c(a).race] - raceIdx[c(b).race]);
    else if (this.rosterSort === "level") ids.sort((a, b) => level(b) - level(a) || time(a) - time(b));
    return ids;
  }

  /* 背包的顯示順序：部位＝分類排；time＝最新取得在最前面（新掉落一眼可見） */
  sortedBag() {
    const items = [...this.state.inventory];
    if (this.bagSort === "slot") items.sort((a, b) => this.cfg.SLOT_ORDER[a.slot] - this.cfg.SLOT_ORDER[b.slot] || a.set.localeCompare(b.set) || a.name.localeCompare(b.name));
    else items.reverse();
    return items;
  }

  /* ---------- 背包批量選取與分解 ---------- */

  toggleBagSelect(itemId, checked) {
    if (checked) this.bagSelected.add(itemId);
    else this.bagSelected.delete(itemId);
    this.renderAll();
  }

  togglePick(slot, checked) {
    this.bagPick[slot] = checked;
    this.renderAll();
  }

  /* 依勾選的部位選取所有「未鎖定且未配戴」的裝備 */
  selectByPick() {
    for (const item of this.state.inventory) {
      if (!this.bagPick[item.slot]) continue;
      if (item.locked || this.game.equipment.findWearer(item.id)) continue;
      this.bagSelected.add(item.id);
    }
    this.renderAll();
  }

  clearBagSelection() {
    this.bagSelected.clear();
    this.renderAll();
  }

  toggleLock(itemId) {
    this.game.equipment.toggleLock(itemId);
    this.bagSelected.delete(itemId);
    this.renderAll();
  }

  bulkSalvage() {
    const eqSvc = this.game.equipment;
    const ids = [...this.bagSelected].filter((id) => {
      const item = this.state.inventory.find((x) => x.id === id);
      return item && !item.locked && !eqSvc.findWearer(id);
    });
    if (!ids.length) return;
    const total = ids.reduce((sum, id) => sum + eqSvc.salvageGain(this.state.inventory.find((x) => x.id === id)), 0);
    if (!confirm(`確定分解選取的 ${ids.length} 件裝備？將獲得礦物精隨 ${total}。`)) return;
    eqSvc.bulkSalvage(ids);
    this.bagSelected.clear();
    this.renderAll();
  }

  /* ---------- 裝備操作（委派 EquipmentService 後重繪） ---------- */

  equip(itemId, cid) {
    if (this.game.equipment.equip(itemId, cid)) this.renderAll();
  }

  unequip(cid, slot) {
    if (this.game.equipment.unequip(cid, slot)) this.renderAll();
  }

  autoEquip(cid) {
    this.game.equipment.autoEquip(cid);
    this.renderAll();
  }

  salvage(itemId) {
    if (this.game.equipment.salvage(itemId)) this.renderAll();
  }

  openEquip(id) {
    this.equipChar = this.equipChar === id ? null : id;
    if (this.equipChar && !this.equipSlot) this.equipSlot = "head";
    this.renderAll();
    if (this.equipChar) {
      const el = $("equipPanel");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  selectSlot(slot) {
    this.equipSlot = slot;
    this.renderAll();
  }

  /* ---------- 召募 ---------- */

  summonResultHTML(r) {
    return `<div class="cardrow card">${this.game.sprites.img("char", r.c.id, 40)}<div class="grow">${r.dup ? `<span class="small">重複：${this.book.label(r.c)} → 英雄精華 +1</span>` : `<span class="good">獲得：${this.book.label(r.c)}！</span>`}</div></div>`;
  }

  doSummon() {
    const r = this.game.summon.summon();
    if (!r) { $("summonResult").textContent = "金幣不足。"; return; }
    $("summonResult").innerHTML = this.summonResultHTML(r);
    this.renderAll();
  }

  doSummon10() {
    const results = this.game.summon.summon10();
    if (!results) { $("summonResult").textContent = "金幣不足（10 連需 900）。"; return; }
    $("summonResult").innerHTML = results.map((r) => this.summonResultHTML(r)).join("");
    this.renderAll();
  }

  doEssenceExchange() {
    const r = this.game.summon.essenceExchange();
    if (r.error) { $("summonResult").textContent = r.error; return; }
    $("summonResult").innerHTML = `<div class="cardrow card">${this.game.sprites.img("char", r.c.id, 40)}<div class="grow"><span class="gold">精華交換獲得：${this.book.label(r.c)}！</span></div></div>`;
    this.renderAll();
  }

  /* ---------- 地圖與存檔 ---------- */

  selectMap(id) {
    this.state.currentMap = id;
    this.state.stage = 1;
    this.state.battle = null;
    this.game.battle.smoothNext = false;
    this.game.persist();
    this.renderAll();
    this.game.view.log(`手動前往 ${this.book.map[id].name}。`, "system");
  }

  importSave() {
    try {
      localStorage.setItem(this.cfg.SAVE_KEY, $("saveText").value);
      this.game.state = this.game.save.load();
      this.renderAll();
      alert("匯入成功");
    } catch {
      alert("存檔格式錯誤");
    }
  }

  resetSave() {
    if (!confirm("確定重置全部進度？")) return;
    this.game.save.wipe();
    this.game.state = this.game.save.defaultState();
    this.game.view.clearLog();
    this.game.view.log("存檔已重置。", "system");
    this.game.restartTimer();
    this.renderAll();
  }

  /* ---------- 更新公告彈窗 ---------- */

  closeUpdateModal() {
    $("updateModal").hidden = true;
    localStorage.setItem(this.cfg.SEEN_VERSION_KEY, this.cfg.VERSION);
  }

  maybeShowUpdateModal() {
    if (location.hash !== "#update" && localStorage.getItem(this.cfg.SEEN_VERSION_KEY) === this.cfg.VERSION) return;
    $("updateVer").textContent = this.cfg.VERSION;
    $("updateNotes").innerHTML = this.cfg.UPDATE_NOTES.map((t) => `<li>${t}</li>`).join("");
    $("updateModal").hidden = false;
  }

  /* ---------- 文字片段（技能／共鳴／屬性比較） ---------- */

  skillLinesHTML(c) {
    const j = this.book.job[c.job];
    const s = this.game.stats.effectiveStats(c);
    const cdEff = { priest: "治療血量最低的隊友240%攻擊", paladin: "恢復自身12%最大生命", mage: "對單體造成220%攻擊傷害" }[c.job] || "對單體造成180%攻擊傷害";
    const trigCond = { warrior: "受擊5次", paladin: "受擊6次", priest: `累積治療達 ${Math.round(s.atk * 10)} 點`, mage: "出手3次", rogue: "出手2次", hunter: "出手4次", warlock: "出手6次" }[c.job];
    const trigEff = { priest: "治療全隊各160%攻擊", warrior: "對單體造成320%攻擊傷害", paladin: "嘲諷全體敵人，他們的下一次攻擊只會打向聖騎士", mage: "對全體敵人各造成220%攻擊傷害", rogue: "對單體造成350%攻擊傷害（必定暴擊）", hunter: "對單體造成450%攻擊傷害", warlock: "對單體造成340%攻擊傷害" }[c.job];
    return `<div class="small"><span class="blue">技能「${j.cdSkill}」</span>CD ${this.game.stats.cdTimeOf(c.job)} 秒：${cdEff}</div><div class="small"><span class="gold">絕技「${j.triggerSkill}」</span>${trigCond}觸發：${trigEff}</div><div class="small"><span class="purple">被動</span>：${j.passive}</div>`;
  }

  resonanceLineHTML(c) {
    const race = this.book.race[c.race];
    const active = this.game.stats.resonance().find((r) => r.race === c.race);
    if (active) return `<div class="small"><span class="good">共鳴</span>：${race.name}×${active.tier}｜${active.text}</div>`;
    return `<div class="small"><span style="opacity:.7">共鳴</span>：${race.name}未觸發（2名時：${race.resonance["2"]}）</div>`;
  }

  raceTraitHTML(c) {
    const race = this.book.race[c.race];
    return `<div class="small">種族「${race.name}」共鳴：2名 ${race.resonance["2"]}｜3名 ${race.resonance["3"]}｜5名 ${race.resonance["5"]}</div>`;
  }

  statDiffHTML(c, item) {
    const before = this.game.stats.effectiveStats(c);
    const after = this.game.stats.effectiveStats(c, item);
    const metrics = [["生命", before.maxHp, after.maxHp, 0], ["攻擊", before.atk, after.atk, 0], ["防禦", before.def, after.def, 0], ["攻速", before.speed, after.speed, 2], ["暴率", before.crit * 100, after.crit * 100, 1]];
    return metrics.map(([name, a, b, d]) => {
      const diff = +(b - a).toFixed(d);
      if (!diff) return `<span class="small">${name}±0</span>`;
      return `<span class="${diff > 0 ? "good" : "bad"}">${name}${diff > 0 ? "+" : ""}${diff.toFixed(d)}</span>`;
    }).join("｜");
  }

  /* ---------- 裝備面板（人體部位圖） ---------- */

  bodyMapHTML(cid) {
    const eqSvc = this.game.equipment;
    const cls = (slot) => `bm-part${eqSvc.slotItemOf(cid, slot) ? " filled" : ""}${this.equipSlot === slot ? " sel" : ""}`;
    const on = (slot) => `onclick="game.ui.selectSlot('${slot}')"`;
    return `<svg class="bodymap" viewBox="0 0 190 150" width="190" height="150">
    <g class="${cls("head")}" ${on("head")}><circle cx="95" cy="25" r="17"/><text x="95" y="29">頭</text></g>
    <g class="${cls("main")}" ${on("main")}><rect x="36" y="52" width="32" height="36" rx="7"/><text x="52" y="74">主手</text></g>
    <g class="${cls("body")}" ${on("body")}><rect x="74" y="48" width="42" height="46" rx="7"/><text x="95" y="75">身體</text></g>
    <g class="${cls("off")}" ${on("off")}><rect x="122" y="52" width="32" height="36" rx="7"/><text x="138" y="74">副手</text></g>
    <g class="${cls("feet")}" ${on("feet")}><rect x="76" y="99" width="17" height="42" rx="5"/><rect x="97" y="99" width="17" height="42" rx="5"/><text x="95" y="124">腳部</text></g>
  </svg>`;
  }

  renderEquipPanel() {
    const box = $("equipPanel");
    if (this.equipChar && !this.state.party.includes(this.equipChar)) this.equipChar = null;
    if (!this.equipChar) {
      box.innerHTML = "";
      return;
    }
    const cid = this.equipChar;
    const c = this.book.get(cid);
    const eqSvc = this.game.equipment;
    const slotRows = Object.keys(this.cfg.SLOTS).map((slot) => {
      const item = eqSvc.slotItemOf(cid, slot);
      return `<div class="slotrow${this.equipSlot === slot ? " sel" : ""}" onclick="game.ui.selectSlot('${slot}')"><span class="small" style="min-width:34px">${this.cfg.SLOT_FULL[slot]}</span><span class="grow">${item ? `<span class="accent">${item.name}</span>` : `<span class="small">（空）</span>`}</span>${item ? `<button class="btn" onclick="event.stopPropagation();game.ui.unequip('${cid}','${slot}')">卸下</button>` : ""}</div>`;
    }).join("");
    let candHTML = "";
    if (this.equipSlot) {
      const items = this.state.inventory.filter((i) => i.slot === this.equipSlot).sort((a, b) => eqSvc.itemScore(b) - eqSvc.itemScore(a));
      candHTML = `<hr><div class="small">「${this.cfg.SLOT_FULL[this.equipSlot]}」可配戴的裝備（${items.length} 件）</div>` + (items.length ? items.map((item) => {
        const wearer = eqSvc.findWearer(item.id);
        const isMine = wearer === cid;
        const wearTag = isMine ? `<span class="good">此角色配戴中</span>` : wearer ? `<span class="gold">配戴中：${this.book.labelOf(wearer)}</span>` : `<span class="small">未配戴</span>`;
        return `<div class="card"><div class="row"><div class="grow"><span class="accent">${item.name}</span> <span class="small">${item.set}套</span><div class="small">攻擊+${item.atk}　生命+${item.hp}　防禦+${item.def}　攻速+${Number(item.speed).toFixed(2)}　暴率+${(Number(item.crit) * 100).toFixed(1)}%</div><div class="small">${this.statDiffHTML(c, item)}</div><div class="small">${wearTag}</div></div><button class="btn primary" onclick="game.ui.equip('${item.id}','${cid}')" ${isMine ? "disabled" : ""}>${wearer && !isMine ? "換裝" : "裝備"}</button></div></div>`;
      }).join("") : `<div class="small" style="margin-top:6px">背包中沒有此部位的裝備，先去戰鬥收集吧。</div>`);
    }
    box.innerHTML = `<hr><div class="row"><strong>裝備檢視：${this.book.label(c)}</strong><button class="btn" onclick="game.ui.openEquip('${cid}')">關閉</button></div><div class="equipwrap"><div>${this.bodyMapHTML(cid)}</div><div class="grow">${slotRows}</div></div>${candHTML}`;
  }

  /* ---------- 全頁渲染 ---------- */

  renderAll() {
    const state = this.state, book = this.book, stats = this.game.stats, eqSvc = this.game.equipment, sprites = this.game.sprites;
    const map = book.map[state.currentMap];

    /* 頂欄 */
    $("mapName").textContent = map.name;
    $("tier").textContent = state.tiers[state.currentMap];
    $("stage").textContent = state.stage;
    $("gold").textContent = state.gold;
    $("essence").textContent = state.essence;
    $("worldClear").textContent = state.worldClear;
    $("statusLine").textContent = state.running ? `自動戰鬥中（${state.speed}x）` : "已暫停";
    $("toggleBtn").textContent = state.running ? "暫停" : "繼續";
    $("speedBtn").textContent = `${state.speed}x`;

    /* 召募頁 */
    $("essenceCount").textContent = state.essence;
    $("essenceBtn").disabled = state.essence < 20 || book.all.every((c) => state.owned.includes(c.id));
    $("summonBtn").disabled = state.gold < 100;
    $("summon10Btn").disabled = state.gold < 900;

    /* 戰鬥頁摘要 */
    $("partySummary").textContent = state.party.map((id) => `${book.labelOf(id)} Lv.${stats.progressOf(id).level}`).join("、") || "無";
    $("enemySummary").textContent = state.battle
      ? state.battle.enemies.map((e) => e.name).join("、")
      : (state.stage === 10 ? `${map.boss}＋${map.elite}＋3隻${map.normal}` : state.stage === 5 ? `${map.elite}＋5隻${map.normal}` : `5隻${map.normal}`) + `｜特性：${map.trait}`;

    /* 隊伍頁 */
    $("partySlots").textContent = `${state.party.length}/${stats.partySlots()}`;
    $("partyList").innerHTML = state.party.map((id, n) => {
      const c = book.get(id);
      const p = stats.progressOf(id);
      const s = stats.effectiveStats(c);
      const eqLine = Object.keys(this.cfg.SLOTS).map((slot) => {
        const it = eqSvc.slotItemOf(id, slot);
        return `${this.cfg.SLOT_FULL[slot]}：${it ? `<span class="accent">${it.name}</span>` : `<span style="opacity:.45">無</span>`}`;
      }).join("　");
      return `<div class="card"><div class="cardrow"><div>${sprites.img("char", id, 44)}</div><div class="grow"><div class="row"><div><span class="name">${n + 1}. ${book.label(c)} Lv.${p.level}</span><div class="small">EXP ${p.exp}/${stats.expNeeded(p.level)}</div></div><div class="wrap"><button class="btn primary" onclick="game.ui.autoEquip('${id}')">一鍵裝備</button><button class="btn ${this.equipChar === id ? "primary" : ""}" onclick="game.ui.openEquip('${id}')">裝備</button><button class="btn danger" onclick="game.ui.toggleParty('${id}')">下陣</button></div></div></div></div><div class="small">HP ${s.maxHp}｜攻擊 ${s.atk}｜防禦 ${s.def}｜攻速 ${s.speed}｜暴率 ${(s.crit * 100).toFixed(1)}%</div><div class="small">${eqLine}</div>${this.skillLinesHTML(c)}${this.resonanceLineHTML(c)}</div>`;
    }).join("");
    this.renderEquipPanel();
    const rs = stats.resonance();
    $("resonanceBox").innerHTML = `種族共鳴：${rs.length ? rs.map((x) => `<span class="badge">${book.race[x.race].name}${x.tier}｜${x.text}</span>`).join("") : "無"}`;
    $("heroSlotBox").innerHTML = stats.heroSlotUnlocked() ? `<span class="accent">英雄槽：空</span><br>已解鎖；英雄卡池尚未置入。` : `英雄槽：未解鎖（完成第 3 周目開啟）`;
    const rosterSorts = [["time", "取得順序"], ["race", "種族"], ["job", "職業"], ["level", "等級"]];
    $("rosterSortBar").innerHTML = `<div class="sortbar">一鍵整理：${rosterSorts.map(([k, name]) => `<button class="btn mini ${this.rosterSort === k ? "primary" : ""}" onclick="game.ui.setRosterSort('${k}')">${name}</button>`).join("")}</div>`;
    $("rosterList").innerHTML = this.sortedRoster().map((id) => book.get(id)).filter(Boolean).map((c) => {
      const on = state.party.includes(c.id);
      const p = stats.progressOf(c.id);
      const detail = !on && this.detailChar === c.id ? `<div style="margin-top:6px">${this.skillLinesHTML(c)}${this.raceTraitHTML(c)}</div>` : "";
      return `<div class="card"><div class="row"><div class="cardrow">${sprites.img("char", c.id, 36)}<div><span class="name">${book.label(c)} Lv.${p.level}</span><div class="small">EXP ${p.exp}/${stats.expNeeded(p.level)}</div></div></div><div class="wrap">${on ? "" : `<button class="btn" onclick="game.ui.toggleDetail('${c.id}')">${this.detailChar === c.id ? "收合" : "詳細"}</button>`}<button class="btn ${on ? "danger" : "primary"}" onclick="game.ui.toggleParty('${c.id}')" ${!on && state.party.length >= stats.partySlots() ? "disabled" : ""}>${on ? "下陣" : "上陣"}</button></div></div>${detail}</div>`;
    }).join("");

    /* 背包頁 */
    this.bagSelected = new Set([...this.bagSelected].filter((id) => state.inventory.some((i) => i.id === id)));
    const sorted = this.sortedBag();
    $("bagCount").textContent = sorted.length;
    $("mineralCount").textContent = state.mineralEssence;
    const bagSorts = [["slot", "部位"], ["time", "最新取得"]];
    const pickBoxes = Object.keys(this.cfg.SLOTS).map((slot) => `<label class="picklabel"><input type="checkbox" ${this.bagPick[slot] ? "checked" : ""} onchange="game.ui.togglePick('${slot}',this.checked)">${this.cfg.SLOT_FULL[slot]}</label>`).join("");
    $("bagTools").innerHTML = `<div class="sortbar" style="margin-bottom:7px">一鍵整理：${bagSorts.map(([k, name]) => `<button class="btn mini ${this.bagSort === k ? "primary" : ""}" onclick="game.ui.setBagSort('${k}')">${name}</button>`).join("")}</div><div class="sortbar">${pickBoxes}<button class="btn mini" onclick="game.ui.selectByPick()">一鍵選取</button><button class="btn mini" onclick="game.ui.clearBagSelection()">取消選取</button><button class="btn mini danger" onclick="game.ui.bulkSalvage()" ${this.bagSelected.size ? "" : "disabled"}>分解選取（${this.bagSelected.size}）</button></div>`;
    $("bagList").innerHTML = sorted.length ? sorted.map((item) => {
      const wearer = eqSvc.findWearer(item.id);
      const locked = !!item.locked;
      const selectable = !locked && !wearer;
      return `<div class="card"><div class="row"><div class="cardrow" style="align-items:flex-start"><input type="checkbox" style="margin-top:5px" ${this.bagSelected.has(item.id) ? "checked" : ""} ${selectable ? "" : "disabled"} onchange="game.ui.toggleBagSelect('${item.id}',this.checked)"><div><div><span class="${wearer ? "bad" : "accent"}">${locked ? "🔒 " : ""}${item.name}</span> <span class="small">${item.set}套｜${this.cfg.SLOT_FULL[item.slot]}｜</span>${wearer ? `<span class="bad">配戴中：${book.labelOf(wearer)}</span>` : `<span class="small">未配戴</span>`}</div><div class="small">攻擊+${item.atk}　生命+${item.hp}　防禦+${item.def}　攻速+${Number(item.speed).toFixed(2)}　暴率+${(Number(item.crit) * 100).toFixed(1)}%（分解得 ${eqSvc.salvageGain(item)} 精隨）</div></div></div><div class="wrap"><button class="btn mini" onclick="game.ui.toggleLock('${item.id}')">${locked ? "解鎖" : "鎖定"}</button><button class="btn mini danger" onclick="game.ui.salvage('${item.id}')" ${locked ? "disabled" : ""}>分解</button></div></div></div>`;
    }).join("") : `<div class="small">尚無裝備，先去戰鬥。</div>`;

    /* 地圖頁 */
    $("mapList").innerHTML = book.data.maps.map((m, index) => `<div class="card"><div class="row"><div class="cardrow">${sprites.img("enemy", m.id, 40)}<div><span class="name">${index + 1}. ${m.name}</span><div class="small">怪物：${m.normal}／${m.elite}／${m.boss}</div><div class="small">特性：${m.trait}｜掉落：${m.set}套｜Tier ${state.tiers[m.id]}</div></div></div><button class="btn ${state.currentMap === m.id ? "primary" : ""}" onclick="game.ui.selectMap('${m.id}')" ${index >= state.unlockedMaps ? "disabled" : ""}>${index >= state.unlockedMaps ? "未解鎖" : state.currentMap === m.id ? "目前" : "前往"}</button></div></div>`).join("");

    this.game.view.render();
  }
}
