/* Game：總指揮——組裝各服務、持有玩家狀態、驅動戰鬥計時器。
   全域變數 game 供內嵌 onclick 使用（game.ui.xxx）。 */
class Game {
  constructor() {
    this.config = CONFIG;
    this.book = new CharacterBook(GAME_DATA);
    this.sprites = new SpriteFactory(PIXELS, ENEMY_SPRITE, JOB_ART);
    this.save = new SaveManager(CONFIG, this.book, GAME_DATA);
    this.state = this.save.load();
    this.stats = new StatsService(this);
    this.equipment = new EquipmentService(this);
    this.battle = new BattleEngine(this);
    this.view = new BattleView(this);
    this.ui = new UIController(this);
    this.timer = null;
  }

  persist() {
    this.save.persist(this.state);
  }

  restartTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.battle.step(), Math.max(110, 680 / this.state.speed));
  }

  start() {
    document.title = `${this.config.TITLE} ${this.config.VERSION}`;
    this.ui.bindEvents();
    this.ui.renderAll();
    this.view.log(`${this.config.TITLE} ${this.config.VERSION} 啟動。`, "system");
    this.restartTimer();
    this.ui.maybeShowUpdateModal();
  }
}

const game = new Game();
game.start();
