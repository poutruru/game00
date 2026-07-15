/* 遊戲靜態資料：種族／職業／地圖／套裝。純資料，不含邏輯。 */
const GAME_DATA={
  "races": [
    {
      "id": "human",
      "name": "人類",
      "resonance": {
        "2": "全隊攻擊與生命 +5%",
        "3": "全隊攻擊與生命 +10%",
        "5": "全隊攻擊與生命 +20%"
      }
    },
    {
      "id": "elf",
      "name": "精靈",
      "resonance": {
        "2": "全隊攻速 +8%",
        "3": "全隊攻速 +15%",
        "5": "全隊攻速 +25%，每第4次普攻追加一次攻擊"
      }
    },
    {
      "id": "beastkin",
      "name": "獸人",
      "resonance": {
        "2": "全隊暴擊率 +6%",
        "3": "全隊暴擊率 +10%、暴擊傷害 +20%",
        "5": "擊殺後全隊攻擊 +25%，持續8秒"
      }
    }
  ],
  "jobs": [
    { "id": "warrior", "name": "戰士", "hp": 620, "atk": 52, "def": 22, "crit": 0.08, "critDmg": 1.5, "aspd": 1.0,
      "attack": "damage", "skills": ["battleShout", "whirlwind"],
      "passive": "越戰越強：生命越低攻擊力越高（每損失1%生命+0.35%攻擊，最多+35%）" },
    { "id": "paladin", "name": "聖騎士", "hp": 800, "atk": 30, "def": 34, "crit": 0.05, "critDmg": 1.5, "aspd": 0.85,
      "attack": "damage", "skills": ["devotionAura", "hammerOfJustice"],
      "passive": "聖光護體：普攻降低目標5%攻擊力4秒，並嘲諷目標（下一次普攻必打聖騎士）" },
    { "id": "priest", "name": "牧師", "hp": 420, "atk": 38, "def": 14, "crit": 0.05, "critDmg": 1.5, "aspd": 0.9,
      "attack": "heal", "skills": ["prayerOfHealing", "resurrection"],
      "passive": "堅韌信念：每場戰鬥第一次受到致命傷害時抵銷該次傷害" },
    { "id": "shaman", "name": "薩滿", "hp": 460, "atk": 36, "def": 16, "crit": 0.05, "critDmg": 1.5, "aspd": 0.95,
      "attack": "heal", "skills": ["healingStream", "windShear"],
      "passive": "風暴凝聚：戰鬥每持續1秒攻擊力+2%（最多+60%），換場重算" },
    { "id": "mage", "name": "法師", "hp": 360, "atk": 66, "def": 8, "crit": 0.08, "critDmg": 1.5, "aspd": 0.9,
      "attack": "damage", "skills": ["meteor", "blizzard"],
      "passive": "烈焰之觸：普攻附加燃燒（每秒20%攻擊傷害，持續3秒）" },
    { "id": "hunter", "name": "獵人", "hp": 420, "atk": 56, "def": 12, "crit": 0.10, "critDmg": 1.5, "aspd": 1.15,
      "attack": "damage", "skills": ["aimedShot", "concussiveShot"],
      "passive": "急速射擊：每次普攻使自身攻速+6%（最多+60%），換場重算" },
    { "id": "rogue", "name": "盜賊", "hp": 400, "atk": 58, "def": 10, "crit": 0.18, "critDmg": 1.6, "aspd": 1.25,
      "attack": "damage", "skills": ["deadlyPoison", "garrote"],
      "passive": "背刺本能：普攻優先攻擊敵方後排" }
  ],
  "maps": [
    {
      "id": "slime",
      "name": "史萊姆平原",
      "normal": "史萊姆",
      "elite": "巨大史萊姆",
      "boss": "史萊姆王",
      "trait": "高生命",
      "set": "史萊姆",
      "setRole": "生存"
    },
    {
      "id": "goblin",
      "name": "哥布林營地",
      "normal": "哥布林",
      "elite": "哥布林勇士",
      "boss": "哥布林王",
      "trait": "高攻速",
      "set": "哥布林",
      "setRole": "攻速"
    },
    {
      "id": "wolf",
      "name": "狼嚎森林",
      "normal": "森林狼",
      "elite": "銀背巨狼",
      "boss": "芬里爾",
      "trait": "高暴擊",
      "set": "狼牙",
      "setRole": "暴擊"
    },
    {
      "id": "spider",
      "name": "黑蛛巢穴",
      "normal": "毒蛛",
      "elite": "劇毒母蛛",
      "boss": "蜘蛛女王",
      "trait": "中毒",
      "set": "毒蛛",
      "setRole": "持續傷害"
    },
    {
      "id": "gargoyle",
      "name": "石像鬼城塞",
      "normal": "石像鬼",
      "elite": "鐵翼石像鬼",
      "boss": "巨像守衛",
      "trait": "高防禦與護盾",
      "set": "破城",
      "setRole": "穿透"
    },
    {
      "id": "grave",
      "name": "骸骨墓園",
      "normal": "骷髏兵",
      "elite": "死亡騎士",
      "boss": "巫妖王",
      "trait": "復活",
      "set": "亡者",
      "setRole": "吸血續航"
    },
    {
      "id": "frost",
      "name": "冰封雪原",
      "normal": "冰元素",
      "elite": "冰霜守衛",
      "boss": "冰霜巨龍",
      "trait": "緩速",
      "set": "冰霜",
      "setRole": "控制增傷"
    },
    {
      "id": "volcano",
      "name": "熔岩火山",
      "normal": "火元素",
      "elite": "熔岩巨人",
      "boss": "炎魔",
      "trait": "燃燒",
      "set": "熔岩",
      "setRole": "技能爆發"
    },
    {
      "id": "abyss",
      "name": "惡魔深淵",
      "normal": "惡魔士兵",
      "elite": "深淵騎士",
      "boss": "巴洛格",
      "trait": "殘血狂暴",
      "set": "深淵",
      "setRole": "低血爆發"
    },
    {
      "id": "castle",
      "name": "魔王城",
      "normal": "魔王親衛",
      "elite": "魔將軍",
      "boss": "魔王",
      "trait": "綜合能力",
      "set": "魔王",
      "setRole": "泛用"
    }
  ],
  "sets": {
    "史萊姆": {
      "2": "生命 +15%",
      "3": "每秒恢復1%生命",
      "5": "生命低於40%時每場立即恢復25%一次"
    },
    "哥布林": {
      "2": "攻速 +10%",
      "3": "普攻15%機率追加一次攻擊",
      "5": "追加攻擊傷害提高至100%"
    },
    "狼牙": {
      "2": "暴擊率 +10%",
      "3": "暴擊傷害 +30%",
      "5": "暴擊後追加一次50%傷害攻擊"
    },
    "毒蛛": {
      "2": "持續傷害 +20%",
      "3": "持續時間 +50%",
      "5": "持續傷害可暴擊"
    },
    "破城": {
      "2": "穿透 +15%",
      "3": "對護盾增傷 +30%",
      "5": "無視敵人25%防禦"
    },
    "亡者": {
      "2": "吸血 +8%",
      "3": "擊殺恢復10%生命",
      "5": "每場首次死亡以30%生命復活"
    },
    "冰霜": {
      "2": "技能附加緩速",
      "3": "對緩速敵人增傷20%",
      "5": "控制時間 +50%"
    },
    "熔岩": {
      "2": "技能傷害 +15%",
      "3": "技能暴擊率 +15%",
      "5": "技能暴擊傷害 +50%"
    },
    "深淵": {
      "2": "生命低於50%傷害 +15%",
      "3": "生命越低攻速越高",
      "5": "生命低於30%傷害 +45%"
    },
    "魔王": {
      "2": "全能力 +8%",
      "3": "技能冷卻 -10%",
      "5": "終結技能傷害 +35%"
    }
  }
};
