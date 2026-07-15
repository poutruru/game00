/* 技能與狀態效果資料（純資料，好維護）。
   ── EFFECTS：固定作用的狀態效果 ──
   kind: dot=持續傷害 / slow=素質降低 / control=控制（打斷詠唱） / shield=護盾 / buff=我方增益 / debuff=敵方減益
   dot 的 tick 基準：atk=施放者攻擊力、maxHp=目標最大生命
   control 細分：stopAll=停止所有動作（暈眩/凍結）、castOnly=只封鎖技能與詠唱、普攻照常（沉默） */
const EFFECTS = {
  burn:    { name: "燃燒", kind: "dot", tick: "atk", ratio: 0.20, duration: 3, color: "burn" },
  poison:  { name: "毒素", kind: "dot", tick: "maxHp", ratio: 0.02, duration: 4, color: "poison" },
  chill:   { name: "冰凍", kind: "slow", ratio: 0.10, duration: 3, color: "ice" },
  freeze:  { name: "凍結", kind: "control", stop: "all" },
  stun:    { name: "暈眩", kind: "control", stop: "all" },
  silence: { name: "沉默", kind: "control", stop: "castOnly" },
  shield:  { name: "護盾", kind: "shield", ratio: 0.20, duration: 3, blockControl: 1 },
  atkUp:   { name: "攻擊提升", kind: "buff", stat: "atk", ratio: 0.10 },
  defUp:   { name: "防禦提升", kind: "buff", stat: "def", ratio: 0.10 },
  atkDown: { name: "攻擊降低", kind: "debuff", stat: "atk", ratio: 0.05 },
};

/* ── SKILLS ──
   type: damage / heal / hot（持續治療）/ buff / control / revive / shield
   target: enemy=單一敵人 / enemies=敵方全體 / row=敵方一整排 / backRow=敵方後排 / allies=我方全體 / deadAlly=陣亡隊友
   mult: 倍率（damage/heal 以攻擊力為基準；hot 為每秒倍率）
   cd: 冷卻秒數；cast: 詠唱秒數（0=瞬發；玩家技能目前皆瞬發，菁英/Boss 詠唱 1 秒可被控制打斷）
   effect+duration: 命中後附加的狀態效果 */
const SKILLS = {
  /* 戰士 */
  battleShout:     { name: "戰吼",     cd: 8,  cast: 0, type: "buff",    target: "allies",  effect: "atkUp",  duration: 3, desc: "提高我方全體10%攻擊力，持續3秒" },
  whirlwind:       { name: "旋風斬",   cd: 6,  cast: 0, type: "damage",  target: "row",     mult: 1.6,                     desc: "對敵方一整排造成160%攻擊傷害" },
  /* 聖騎士 */
  devotionAura:    { name: "虔誠聖光", cd: 8,  cast: 0, type: "buff",    target: "allies",  effect: "defUp",  duration: 3, desc: "提高我方全體10%防禦力，持續3秒" },
  hammerOfJustice: { name: "制裁之鎚", cd: 10, cast: 0, type: "control", target: "enemy",   effect: "stun",   duration: 3, desc: "暈眩單一敵人3秒，可打斷詠唱" },
  /* 牧師 */
  prayerOfHealing: { name: "治療禱言", cd: 8,  cast: 0, type: "heal",    target: "allies",  mult: 1.2,                     desc: "回復我方全體120%攻擊的生命" },
  resurrection:    { name: "復活術",   cd: 16, cast: 0, type: "revive",  target: "deadAlly",                               desc: "復活一名陣亡隊友（無人陣亡則補滿血量最低的隊友）" },
  /* 薩滿 */
  healingStream:   { name: "治療之泉", cd: 10, cast: 0, type: "hot",     target: "allies",  mult: 0.35, duration: 5,       desc: "我方全體每秒回復35%攻擊的生命，持續5秒" },
  windShear:       { name: "風剪",     cd: 12, cast: 0, type: "control", target: "enemies", effect: "silence", duration: 3, desc: "沉默敵方全體3秒：打斷且無法詠唱技能，但仍會普攻" },
  /* 法師 */
  meteor:          { name: "隕石術",   cd: 8,  cast: 0, type: "damage",  target: "enemies", mult: 1.3,                     desc: "對敵方全體造成130%攻擊傷害" },
  blizzard:        { name: "暴風雪",   cd: 12, cast: 0, type: "control", target: "enemies", effect: "freeze", duration: 1, desc: "凍結敵方全體1秒：停止所有動作，可打斷詠唱" },
  /* 獵人 */
  aimedShot:       { name: "瞄準射擊", cd: 6,  cast: 0, type: "damage",  target: "enemy",   mult: 2.6,                     desc: "對單一敵人造成260%攻擊傷害" },
  concussiveShot:  { name: "震盪射擊", cd: 10, cast: 0, type: "control", target: "enemy",   effect: "stun",   duration: 3, desc: "暈眩單一敵人3秒，可打斷詠唱" },
  /* 盜賊 */
  deadlyPoison:    { name: "毒襲",     cd: 8,  cast: 0, type: "damage",  target: "backRow", mult: 1.0, effect: "poison",   desc: "對敵方後排造成100%攻擊傷害並附加毒素（每秒2%最大生命，持續4秒）" },
  garrote:         { name: "鎖喉",     cd: 12, cast: 0, type: "damage",  target: "enemy",   mult: 2.2, effect: "silence", duration: 3, desc: "對單一敵人造成220%攻擊傷害並沉默3秒" },

  /* ── 敵方技能（菁英/Boss：CD5秒、詠唱1秒，詠唱可被控制打斷，打斷後下一次只會普攻） ── */
  eliteSmash: { name: "重擊",     cd: 5, cast: 1, type: "damage", target: "enemy",   mult: 2.5, desc: "對單一目標造成250%攻擊傷害" },
  bossSmash:  { name: "致命重擊", cd: 5, cast: 1, type: "damage", target: "enemy",   mult: 3.2, desc: "對單一目標造成320%攻擊傷害" },
  bossNova:   { name: "毀滅新星", cd: 5, cast: 1, type: "damage", target: "enemies", mult: 1.6, desc: "對全體造成160%攻擊傷害" },
  bossShield: { name: "石化屏障", cd: 5, cast: 1, type: "shield", target: "self",    desc: "獲得20%最大生命的護盾3秒，期間免疫一次控制" },
  minionHeal: { name: "治療",     cd: 5, cast: 1, type: "heal",   target: "lowest",  mult: 2.0, desc: "治療我方血量最低者200%攻擊" },
};
