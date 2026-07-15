/* UIController：分頁渲染與玩家操作（陣型拖曳、裝備、背包、地圖、紀錄、存檔、說明與公告）。
   內嵌 HTML 的 onclick 一律呼叫 game.ui.xxx(...)。 */
class UIController {
  constructor(game) {
    this.game = game;
    this.equipChar = null;
    this.equipSlot = null;
    this.detailChar = null;
    this.rosterSort = "time";
    this.bagSort = "slot";
    this.bagSelected = new Set();
    this.bagPick = { head: true, body: true, feet: true, main: true, off: true };
  }

  get state() { return this.game.state; }
  get book() { return this.game.book; }
  get cfg() { return this.game.config; }

  /* ---------- 事件綁定 ---------- */

  bindEvents() {
    document.querySelectorAll("nav button").forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll("nav button").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".page").forEach((x) => x.classList.remove("active"));
        button.classList.add("active");
        $(button.dataset.page).classList.add("active");
      };
    });
    $("toggleBtn").onclick = () => { this.state.running = !this.state.running; this.game.persist(); this.renderAll(); };
    $("speedBtn").onclick = () => { this.state.speed = this.state.speed === 1 ? 2 : this.state.speed === 2 ? 5 : 1; this.game.persist(); this.game.restartTimer(); this.renderAll(); };
    $("exportBtn").onclick = () => { $("saveText").value = JSON.stringify({ ...this.state, battle: null }, null, 2); };
    $("importBtn").onclick = () => this.importSave();
    $("resetBtn").onclick = () => this.resetSave();
    $("helpBtn").onclick = () => this.showHelp();
    $("dataPreview").textContent = JSON.stringify(this.book.data, null, 2);
  }

  /* ---------- 陣型（6 格拖曳） ---------- */

  placeChar(id, slotIdx) {
    const f = this.state.formation;
    const from = f.indexOf(id);
    const occupant = f[slotIdx];
    if (from === slotIdx) return;
    if (from < 0 && !occupant) {
      const count = f.filter(Boolean).length;
      if (count >= this.game.stats.fieldCap()) { alert(`上陣人數已滿（${this.game.stats.fieldCap()} 人）。`); return; }
    }
    if (from >= 0) f[from] = occupant || null; /* 交換或移動 */
    else if (occupant) f[slotIdx] = null; /* 從名單拖入且格子有人 → 原角色下陣 */
    f[slotIdx] = id;
    this.state.battle = null;
    this.game.persist();
    this.renderAll();
  }

  removeFromSlot(slotIdx) {
    this.state.formation[slotIdx] = null;
    this.state.battle = null;
    this.game.persist();
    this.renderAll();
  }

  deploy(id) { /* 上陣：放進第一個空格（先前排後後排） */
    const f = this.state.formation;
    if (f.includes(id)) return;
    if (f.filter(Boolean).length >= this.game.stats.fieldCap()) { alert(`上陣人數已滿（${this.game.stats.fieldCap()} 人）。`); return; }
    const empty = f.findIndex((x) => !x);
    if (empty >= 0) this.placeChar(id, empty);
  }

  undeploy(id) {
    const i = this.state.formation.indexOf(id);
    if (i >= 0) this.removeFromSlot(i);
  }

  onDragStart(ev, payload) { ev.dataTransfer.setData("text/plain", payload); }
  onDragOver(ev) { ev.preventDefault(); ev.currentTarget.classList.add("dragover"); }
  onDragLeave(ev) { ev.currentTarget.classList.remove("dragover"); }
  onDrop(ev, slotIdx) {
    ev.preventDefault();
    ev.currentTarget.classList.remove("dragover");
    const data = ev.dataTransfer.getData("text/plain");
    if (!data) return;
    if (data.startsWith("char:")) this.placeChar(data.slice(5), slotIdx);
    else if (data.startsWith("slot:")) {
      const from = +data.slice(5);
      const id = this.state.formation[from];
      if (id != null) this.placeChar(id, slotIdx);
    }
  }

  renderFormation() {
    const f = this.state.formation;
    const slotHTML = (i) => {
      const id = f[i];
      const inner = id
        ? `<button class="fx" onclick="game.ui.removeFromSlot(${i})">✕</button>${this.game.sprites.img("char", id, 40)}<div class="fname">${this.book.labelOf(id)}</div>`
        : `<div class="small" style="opacity:.5">空位</div>`;
      return `<div class="fslot${id ? " filled" : ""}" ${id ? `draggable="true" ondragstart="game.ui.onDragStart(event,'slot:${i}')"` : ""} ondragover="game.ui.onDragOver(event)" ondragleave="game.ui.onDragLeave(event)" ondrop="game.ui.onDrop(event,${i})">${inner}</div>`;
    };
    $("formationGrid").innerHTML =
      `<div class="rowlabel">前排</div><div class="formation">${[0, 1, 2].map(slotHTML).join("")}</div>` +
      `<div class="rowlabel">後排</div><div class="formation">${[3, 4, 5].map(slotHTML).join("")}</div>`;
  }

  /* ---------- 職業解鎖與提示視窗 ---------- */

  unlockJob(job) {
    if (this.state.unlockedJobs.includes(job)) return;
    this.state.unlockedJobs.push(job);
    this.game.persist();
    this.showInfo("新職業加入！", [`獲得職業：${this.book.labelOf(job)}！到「隊伍」頁把他拖進陣型吧。`]);
    this.game.view.log(`獲得職業：${this.book.labelOf(job)}！`, "system");
  }

  showInfo(title, lines) {
    $("infoTitle").textContent = title;
    $("infoBody").innerHTML = lines.map((t) => `<li>${t}</li>`).join("");
    $("infoModal").hidden = false;
  }

  closeInfo() { $("infoModal").hidden = true; }

  showHelp() {
    this.showInfo("📖 遊戲說明", [
      "全隊共用「隊伍等級」，打怪獲得經驗，所有角色素質隨隊伍等級成長。",
      "陣型分前排／後排：敵人普攻優先打前排；盜賊等職業會偷襲後排。",
      "初始職業：戰士、法師、牧師。通關第 5 張地圖 Boss 獲得「獵人」。",
      "一周目通關：上陣 +1 人、獲得「盜賊」。二周目：上陣 +1 人（上限5）、獲得「聖騎士」。",
      "三周目：獲得「薩滿」；三周目起每輪通關獲得英雄精華 ×5（精華目前沒有用途，之後開放兌換）。",
      "菁英與 Boss 會「詠唱」強力技能（黃色詠唱條），用暈眩／沉默／凍結技能可以打斷，被打斷的敵人下一次只能普攻。",
      "Boss 關的小怪會幫 Boss 補血，優先清掉！",
      "裝備等級＝掉落時的地圖 Tier（周目越高 Tier 越高）。洗素質花費礦物精隨，同一件成本逐次翻倍。",
    ]);
  }

  /* ---------- 一鍵整理 ---------- */

  setRosterSort(key) { this.rosterSort = key; this.renderAll(); }
  setBagSort(key) { this.bagSort = key; this.renderAll(); }

  sortedRoster() {
    const ids = [...this.state.unlockedJobs];
    const jobIdx = Object.fromEntries(this.book.data.jobs.map((j, i) => [j.id, i]));
    if (this.rosterSort === "job") ids.sort((a, b) => jobIdx[a] - jobIdx[b]);
    return ids;
  }

  sortedBag() {
    const items = [...this.state.inventory];
    if (this.bagSort === "slot") items.sort((a, b) => this.cfg.SLOT_ORDER[a.slot] - this.cfg.SLOT_ORDER[b.slot] || (b.level || 1) - (a.level || 1) || a.name.localeCompare(b.name));
    else if (this.bagSort === "level") items.sort((a, b) => (b.level || 1) - (a.level || 1));
    else items.reverse();
    return items;
  }

  /* ---------- 背包：選取／鎖定／分解／洗素質 ---------- */

  toggleBagSelect(itemId, checked) { checked ? this.bagSelected.add(itemId) : this.bagSelected.delete(itemId); this.renderAll(); }
  togglePick(slot, checked) { this.bagPick[slot] = checked; this.renderAll(); }

  selectByPick() {
    for (const item of this.state.inventory) {
      if (!this.bagPick[item.slot] || item.locked || this.game.equipment.findWearer(item.id)) continue;
      this.bagSelected.add(item.id);
    }
    this.renderAll();
  }

  clearBagSelection() { this.bagSelected.clear(); this.renderAll(); }
  toggleLock(itemId) { this.game.equipment.toggleLock(itemId); this.bagSelected.delete(itemId); this.renderAll(); }
  reroll(itemId) { if (this.game.equipment.reroll(itemId)) this.renderAll(); }

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

  /* ---------- 裝備操作 ---------- */

  equip(itemId, cid) { if (this.game.equipment.equip(itemId, cid)) this.renderAll(); }
  unequip(cid, slot) { if (this.game.equipment.unequip(cid, slot)) this.renderAll(); }
  autoEquip(cid) { this.game.equipment.autoEquip(cid); this.renderAll(); }
  salvage(itemId) { if (this.game.equipment.salvage(itemId)) this.renderAll(); }

  openEquip(id) {
    this.equipChar = this.equipChar === id ? null : id;
    if (this.equipChar && !this.equipSlot) this.equipSlot = "head";
    this.renderAll();
    if (this.equipChar) {
      const el = $("equipPanel");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  selectSlot(slot) { this.equipSlot = slot; this.renderAll(); }
  toggleDetail(id) { this.detailChar = this.detailChar === id ? null : id; this.renderAll(); }

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
    } catch { alert("存檔格式錯誤"); }
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

  /* ---------- 更新公告 ---------- */

  closeUpdateModal() { $("updateModal").hidden = true; localStorage.setItem(this.cfg.SEEN_VERSION_KEY, this.cfg.VERSION); }

  maybeShowUpdateModal() {
    if (location.hash !== "#update" && localStorage.getItem(this.cfg.SEEN_VERSION_KEY) === this.cfg.VERSION) return;
    $("updateVer").textContent = this.cfg.VERSION;
    $("updateNotes").innerHTML = this.cfg.UPDATE_NOTES.map((t) => `<li>${t}</li>`).join("");
    $("updateModal").hidden = false;
  }

  /* ---------- 文字片段 ---------- */

  skillLinesHTML(jobId) {
    const j = this.book.job[jobId];
    const lines = [`<div class="small"><span class="purple">被動</span>：${j.passive}</div>`];
    const attackDesc = j.attack === "heal" ? "治療我方血量最低者120%攻擊" : "攻擊敵方前排（部分職業有特殊目標）";
    lines.push(`<div class="small"><span style="opacity:.8">普攻</span>：${attackDesc}</div>`);
    for (const sid of j.skills) {
      const s = SKILLS[sid];
      lines.push(`<div class="small"><span class="blue">「${s.name}」</span>CD ${s.cd} 秒：${s.desc}</div>`);
    }
    return lines.join("");
  }

  statDiffHTML(c, item) {
    const before = this.game.stats.effectiveStats(c);
    const after = this.game.stats.effectiveStats(c, item);
    const metrics = [["生命", before.maxHp, after.maxHp, 0], ["攻擊", before.atk, after.atk, 0], ["防禦", before.def, after.def, 0], ["攻速", before.aspd, after.aspd, 2], ["暴率", before.crit * 100, after.crit * 100, 1]];
    return metrics.map(([name, a, b, d]) => {
      const diff = +(b - a).toFixed(d);
      if (!diff) return `<span class="small">${name}±0</span>`;
      return `<span class="${diff > 0 ? "good" : "bad"}">${name}${diff > 0 ? "+" : ""}${diff.toFixed(d)}</span>`;
    }).join("｜");
  }

  /* ---------- 裝備面板 ---------- */

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
    if (this.equipChar && !this.state.unlockedJobs.includes(this.equipChar)) this.equipChar = null;
    if (!this.equipChar) { box.innerHTML = ""; return; }
    const cid = this.equipChar;
    const c = this.book.get(cid);
    const eqSvc = this.game.equipment;
    const slotRows = Object.keys(this.cfg.SLOTS).map((slot) => {
      const item = eqSvc.slotItemOf(cid, slot);
      return `<div class="slotrow${this.equipSlot === slot ? " sel" : ""}" onclick="game.ui.selectSlot('${slot}')"><span class="small" style="min-width:34px">${this.cfg.SLOT_FULL[slot]}</span><span class="grow">${item ? `<span class="accent">${item.name} Lv.${item.level || 1}</span>` : `<span class="small">（空）</span>`}</span>${item ? `<button class="btn" onclick="event.stopPropagation();game.ui.unequip('${cid}','${slot}')">卸下</button>` : ""}</div>`;
    }).join("");
    let candHTML = "";
    if (this.equipSlot) {
      const items = this.state.inventory.filter((i) => i.slot === this.equipSlot).sort((a, b) => eqSvc.itemScore(b) - eqSvc.itemScore(a));
      candHTML = `<hr><div class="small">「${this.cfg.SLOT_FULL[this.equipSlot]}」可配戴的裝備（${items.length} 件）</div>` + (items.length ? items.map((item) => {
        const wearer = eqSvc.findWearer(item.id);
        const isMine = wearer === cid;
        const wearTag = isMine ? `<span class="good">此角色配戴中</span>` : wearer ? `<span class="gold">配戴中：${this.book.labelOf(wearer)}</span>` : `<span class="small">未配戴</span>`;
        return `<div class="card"><div class="row"><div class="grow"><span class="accent">${item.name} Lv.${item.level || 1}</span> <span class="small">${item.set}套</span><div class="small">攻擊+${item.atk}　生命+${item.hp}　防禦+${item.def}　攻速+${Number(item.speed).toFixed(2)}　暴率+${(Number(item.crit) * 100).toFixed(1)}%</div><div class="small">${this.statDiffHTML(c, item)}</div><div class="small">${wearTag}</div></div><button class="btn primary" onclick="game.ui.equip('${item.id}','${cid}')" ${isMine ? "disabled" : ""}>${wearer && !isMine ? "換裝" : "裝備"}</button></div></div>`;
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
    $("teamLevel").textContent = state.teamLevel;
    $("teamExp").textContent = state.teamExp;
    $("teamExpNeed").textContent = stats.expNeeded(state.teamLevel);
    $("essence").textContent = state.essence;
    $("statusLine").textContent = state.running ? `自動戰鬥中（${state.speed}x）` : "已暫停";
    $("toggleBtn").textContent = state.running ? "暫停" : "繼續";
    $("speedBtn").textContent = `${state.speed}x`;

    /* 戰鬥頁摘要 */
    $("partySummary").textContent = stats.partyIds().map((id) => book.labelOf(id)).join("、") || "無（去隊伍頁擺陣型！）";
    $("enemySummary").textContent = (state.stage === 10 ? `Boss關：${map.boss}` : state.stage === 5 ? `菁英關：${map.elite}＋${map.normal}` : `5隻${map.normal}`) + `｜特性：${map.trait}`;

    /* 隊伍頁 */
    $("fieldCount").textContent = `${stats.partyIds().length}/${stats.fieldCap()}`;
    this.renderFormation();
    this.renderEquipPanel();
    const rosterSorts = [["time", "取得順序"], ["job", "職業"]];
    $("rosterSortBar").innerHTML = `<div class="sortbar">一鍵整理：${rosterSorts.map(([k, name]) => `<button class="btn mini ${this.rosterSort === k ? "primary" : ""}" onclick="game.ui.setRosterSort('${k}')">${name}</button>`).join("")}</div>`;
    $("rosterList").innerHTML = this.sortedRoster().map((id) => {
      const j = book.job[id];
      const on = state.formation.includes(id);
      const s = stats.effectiveStats({ id, job: id });
      const detail = this.detailChar === id ? `<div style="margin-top:6px">${this.skillLinesHTML(id)}</div>` : "";
      return `<div class="card"><div class="row"><div class="cardrow dragchar" draggable="true" ondragstart="game.ui.onDragStart(event,'char:${id}')">${sprites.img("char", id, 40)}<div><span class="name">${j.name}</span><div class="small">HP ${s.maxHp}｜攻 ${s.atk}｜防 ${s.def}｜攻速 ${s.aspd}｜暴 ${(s.crit * 100).toFixed(0)}%</div></div></div><div class="wrap"><button class="btn mini" onclick="game.ui.toggleDetail('${id}')">${this.detailChar === id ? "收合" : "技能"}</button><button class="btn mini" onclick="game.ui.autoEquip('${id}')">一鍵裝備</button><button class="btn mini ${this.equipChar === id ? "primary" : ""}" onclick="game.ui.openEquip('${id}')">裝備</button><button class="btn mini ${on ? "danger" : "primary"}" onclick="game.ui.${on ? "undeploy" : "deploy"}('${id}')">${on ? "下陣" : "上陣"}</button></div></div>${detail}</div>`;
    }).join("");

    /* 背包頁 */
    this.bagSelected = new Set([...this.bagSelected].filter((id) => state.inventory.some((i) => i.id === id)));
    const sorted = this.sortedBag();
    $("bagCount").textContent = sorted.length;
    $("mineralCount").textContent = state.mineralEssence;
    const bagSorts = [["slot", "部位"], ["level", "等級"], ["time", "最新取得"]];
    const pickBoxes = Object.keys(this.cfg.SLOTS).map((slot) => `<label class="picklabel"><input type="checkbox" ${this.bagPick[slot] ? "checked" : ""} onchange="game.ui.togglePick('${slot}',this.checked)">${this.cfg.SLOT_FULL[slot]}</label>`).join("");
    $("bagTools").innerHTML = `<div class="sortbar" style="margin-bottom:7px">一鍵整理：${bagSorts.map(([k, name]) => `<button class="btn mini ${this.bagSort === k ? "primary" : ""}" onclick="game.ui.setBagSort('${k}')">${name}</button>`).join("")}</div><div class="sortbar">${pickBoxes}<button class="btn mini" onclick="game.ui.selectByPick()">一鍵選取</button><button class="btn mini" onclick="game.ui.clearBagSelection()">取消選取</button><button class="btn mini danger" onclick="game.ui.bulkSalvage()" ${this.bagSelected.size ? "" : "disabled"}>分解選取（${this.bagSelected.size}）</button></div>`;
    $("bagList").innerHTML = sorted.length ? sorted.map((item) => {
      const wearer = eqSvc.findWearer(item.id);
      const locked = !!item.locked;
      const selectable = !locked && !wearer;
      const cost = eqSvc.rerollCost(item);
      return `<div class="card"><div class="row"><div class="cardrow" style="align-items:flex-start"><input type="checkbox" style="margin-top:5px" ${this.bagSelected.has(item.id) ? "checked" : ""} ${selectable ? "" : "disabled"} onchange="game.ui.toggleBagSelect('${item.id}',this.checked)"><div><div><span class="${wearer ? "bad" : "accent"}">${locked ? "🔒 " : ""}${item.name} Lv.${item.level || 1}</span> <span class="small">${item.set}套｜${this.cfg.SLOT_FULL[item.slot]}｜</span>${wearer ? `<span class="bad">配戴中：${book.labelOf(wearer)}</span>` : `<span class="small">未配戴</span>`}</div><div class="small">攻擊+${item.atk}　生命+${item.hp}　防禦+${item.def}　攻速+${Number(item.speed).toFixed(2)}　暴率+${(Number(item.crit) * 100).toFixed(1)}%（分解得 ${eqSvc.salvageGain(item)} 精隨）</div></div></div><div class="wrap"><button class="btn mini" onclick="game.ui.reroll('${item.id}')" ${state.mineralEssence < cost ? "disabled" : ""}>洗素質(${cost})</button><button class="btn mini" onclick="game.ui.toggleLock('${item.id}')">${locked ? "解鎖" : "鎖定"}</button><button class="btn mini danger" onclick="game.ui.salvage('${item.id}')" ${locked ? "disabled" : ""}>分解</button></div></div></div>`;
    }).join("") : `<div class="small">尚無裝備，先去戰鬥。</div>`;

    /* 地圖頁 */
    $("mapList").innerHTML = book.data.maps.map((m, index) => `<div class="card"><div class="row"><div class="cardrow">${sprites.img("enemy", m.id, 40)}<div><span class="name">${index + 1}. ${m.name}</span><div class="small">怪物：${m.normal}／${m.elite}／${m.boss}</div><div class="small">特性：${m.trait}｜掉落：${m.set}套 Lv.${state.tiers[m.id]}｜Tier ${state.tiers[m.id]}</div></div></div><button class="btn ${state.currentMap === m.id ? "primary" : ""}" onclick="game.ui.selectMap('${m.id}')" ${index >= state.unlockedMaps ? "disabled" : ""}>${index >= state.unlockedMaps ? "未解鎖" : state.currentMap === m.id ? "目前" : "前往"}</button></div></div>`).join("");

    this.game.view.render();
  }
}
