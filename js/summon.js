/* SummonService：召募抽卡與英雄精華交換。只處理邏輯與 state，結果的呈現交給 UIController。 */
class SummonService {
  constructor(game) {
    this.game = game;
  }

  get state() {
    return this.game.state;
  }

  /* 抽一次：重複角色轉精華 */
  rollOnce() {
    const c = rand(this.game.book.all);
    if (this.state.owned.includes(c.id)) {
      this.state.essence++;
      return { c, dup: true };
    }
    this.state.owned.push(c.id);
    this.state.progress[c.id] = { level: 1, exp: 0 };
    return { c, dup: false };
  }

  /* 單抽 100 金幣；金額不足回傳 null */
  summon() {
    if (this.state.gold < 100) return null;
    this.state.gold -= 100;
    const result = this.rollOnce();
    this.game.persist();
    return result;
  }

  /* 10 連 900 金幣 */
  summon10() {
    if (this.state.gold < 900) return null;
    this.state.gold -= 900;
    const results = [];
    for (let i = 0; i < 10; i++) results.push(this.rollOnce());
    this.game.persist();
    return results;
  }

  /* 20 精華必得一名尚未擁有的隨機角色；不足或全擁有回傳對應錯誤碼 */
  essenceExchange() {
    const pool = this.game.book.all.filter((c) => !this.state.owned.includes(c.id));
    if (this.state.essence < 20) return { error: "精華不足（需 20）。" };
    if (!pool.length) return { error: "所有角色都已擁有！" };
    this.state.essence -= 20;
    const c = rand(pool);
    this.state.owned.push(c.id);
    this.state.progress[c.id] = { level: 1, exp: 0 };
    this.game.persist();
    return { c };
  }
}
