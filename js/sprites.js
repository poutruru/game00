/* SpriteFactory：把美術資源轉成 <img> 可用的 data URL。
   優先序：手繪立繪（JOB_ART，職業共用）→ 程式繪製 16×16 像素網格（PIXELS）。 */
class SpriteFactory {
  constructor(pixels, enemySprite, jobArt) {
    this.pixels = pixels;
    this.enemySprite = enemySprite;
    this.jobArt = jobArt;
    this.cache = {};
  }

  /* kind: "char"（key=角色id 如 human_warrior）或 "enemy"（key=地圖id） */
  url(kind, key) {
    if (kind === "char") {
      const job = key.split("_")[1];
      if (this.jobArt[job]) return this.jobArt[job].idle;
    }
    const cacheKey = kind + ":" + key;
    if (this.cache[cacheKey]) return this.cache[cacheKey];
    let grid, pal;
    if (kind === "char") {
      const [race, job] = key.split("_");
      const spr = this.pixels.heroes[job];
      if (!spr) return "";
      grid = spr.grid;
      pal = { ...spr.palette, ...(this.pixels.racePalettes[race] || {}) };
    } else {
      const spr = this.pixels.enemies[this.enemySprite[key]] || this.pixels.enemies.slime;
      grid = spr.grid;
      pal = spr.palette;
    }
    const cv = document.createElement("canvas");
    cv.width = 16;
    cv.height = 16;
    const ctx = cv.getContext("2d");
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        ctx.fillStyle = pal[ch] || "#f0f";
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return (this.cache[cacheKey] = cv.toDataURL());
  }

  img(kind, key, size = 48) {
    return `<img class="pix" src="${this.url(kind, key)}" width="${size}" height="${size}" alt="">`;
  }

  /* 攻擊影格（之後由手繪提供）；沒有影格的職業回傳 null */
  attackFrames(charId) {
    const art = this.jobArt[charId.split("_")[1]];
    return art && art.atk ? art : null;
  }
}
