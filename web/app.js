
document.addEventListener("DOMContentLoaded", async () => {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const app = document.querySelector("#app") || document.body;
  const balanceEl = document.querySelector("#balance");
  const inventoryEl = document.querySelector("#inventory");
  const profileEl = document.querySelector("#profile");
  const animationEl = document.querySelector("#case-animation");

  let player = null;
  let busy = false;
  let activeTab = "cases";

  const CASES = [
    { price: 50, name: "Старт", emoji: "🎁" },
    { price: 100, name: "Про", emoji: "💎" },
    { price: 250, name: "VIP", emoji: "👑" },
    { price: 500, name: "Легенда", emoji: "🐉" }
  ];

  // ---------- СТИЛИ ----------

  const style = document.createElement("style");

  style.textContent = `
    :root {
      --lime: #c6ff00;
      --bg: #101010;
      --panel: #1b1b1b;
      --text: #f5f5f5;
      --muted: #999;
      --border: #303030;
      --danger: #ff5757;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding-bottom: 100px;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, sans-serif;
    }

    #app {
      max-width: 760px;
      margin: auto;
    }

    .top-bar {
      padding: 18px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border);
    }

    .top-bar h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
    }

    .top-bar h1 span,
    #balance {
      color: var(--lime);
    }

    .balance-box {
      padding: 12px;
      background: #222;
      border-radius: 12px;
      font-size: 13px;
    }

    main {
      padding: 14px;
    }

    h2 {
      font-size: 21px;
    }

    #ludoman-topup,
    #ludoman-cases,
    #case-animation,
    #inventory,
    #profile {
      padding: 0 14px;
    }

    #ludoman-topup {
      padding-top: 14px;
    }

    .cases {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .case-card,
    .panel {
      padding: 16px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      min-width: 0;
    }

    .case-card {
      text-align: center;
    }

    .case-emoji {
      font-size: 38px;
    }

    .case-card h3 {
      margin: 10px 0;
    }

    .case-card p,
    .muted {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    button {
      padding: 12px;
      border: none;
      border-radius: 11px;
      background: var(--lime);
      color: #101010;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
    }

    button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .open-btn {
      width: 100%;
    }

    .panel {
      margin: 14px 0;
      overflow-wrap: anywhere;
    }

    .panel h3 {
      margin-top: 0;
    }

    .topup-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    .topup-row button {
      width: 100%;
    }

    .custom-topup {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .custom-topup input {
      width: 100%;
      min-width: 0;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #444;
      background: #111;
      color: white;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 13px 0;
      border-bottom: 1px solid #333;
    }

    .item:last-child {
      border-bottom: none;
    }

    .item-icon {
      width: 52px;
      height: 52px;
      flex: 0 0 52px;
      display: grid;
      place-items: center;
      background: #262626;
      border: 1px solid #393939;
      border-radius: 14px;
      font-size: 28px;
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-info strong {
      overflow-wrap: anywhere;
    }

    .item-actions {
      margin-top: 9px;
    }

    .sell-btn {
      padding: 9px 12px;
      font-size: 12px;
      white-space: nowrap;
    }

    .sell-price {
      color: var(--lime);
      font-weight: bold;
    }

    .rarity {
      display: inline-block;
      margin-top: 5px;
      padding: 4px 7px;
      background: #292929;
      border-radius: 6px;
      color: var(--lime);
      font-size: 10px;
      font-weight: bold;
    }

    .notice {
      padding: 13px;
      margin: 12px 14px;
      border-radius: 12px;
      background: #252525;
      border: 1px solid #444;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .notice.error {
      border-color: var(--danger);
    }

    .hidden {
      display: none !important;
    }

    .roulette {
      margin: 18px 0;
      padding: 16px;
      text-align: center;
      background: #171717;
      border: 1px solid #333;
      border-radius: 16px;
    }

    .win {
      color: var(--lime);
      font-weight: bold;
      margin: 14px 0;
    }

    .bottom-menu {
      position: fixed;
      z-index: 100;
      bottom: 0;
      left: 0;
      right: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      max-width: 760px;
      margin: auto;
      padding: 10px 12px;
      background: rgba(16, 16, 16, .96);
      border-top: 1px solid #303030;
      padding-bottom: max(10px, env(safe-area-inset-bottom));
    }

    .bottom-menu button {
      padding: 12px 5px;
      background: #252525;
      color: #eee;
      border: 1px solid #393939;
      font-size: 12px;
    }

    .bottom-menu button.active {
      background: var(--lime);
      color: #101010;
      border-color: var(--lime);
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .empty-state {
      padding: 28px 12px;
      text-align: center;
      color: var(--muted);
    }

    .empty-state .big-emoji {
      font-size: 48px;
      margin-bottom: 10px;
    }

    .tab-heading {
      margin: 18px 0 10px;
    }

    @media (max-width: 360px) {
      .cases {
        grid-template-columns: 1fr;
      }

      .item {
        align-items: flex-start;
      }

      .item-icon {
        width: 44px;
        height: 44px;
        flex-basis: 44px;
        font-size: 24px;
      }

      .sell-btn {
        padding: 8px;
      }
    }
  `;

  document.head.appendChild(style);

  // ---------- УВЕДОМЛЕНИЯ ----------

  function notify(message, isError = false) {
    let el = document.querySelector("#app-notice");

    if (!el) {
      el = document.createElement("div");
      el.id = "app-notice";
      el.className = "notice";
      app.prepend(el);
    }

    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.remove("hidden");
  }

  function clearNotice() {
    const el = document.querySelector("#app-notice");
    if (el) el.classList.add("hidden");
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ru-RU");
  }

  // ---------- API ----------

  async function api(path, options = {}) {
    if (!tg?.initData) {
      throw new Error("Открой приложение через Telegram.");
    }

    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": tg.initData,
        ...(options.headers || {})
      }
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Сервер вернул неверный ответ.");
    }

    if (!response.ok) {
      throw new Error(
        data.detail || data.message || "Ошибка сервера."
      );
    }

    return data;
  }

  function getName(item) {
    return item?.name || item?.title || "Награда";
  }

  function getEmoji(item) {
    return item?.icon || item?.emoji || "🎁";
  }

  // ---------- НАВИГАЦИЯ ----------

  function setupNavigation() {
    let menu = document.querySelector(".bottom-menu");

    if (!menu) {
      menu = document.createElement("nav");
      menu.className = "bottom-menu";
      app.appendChild(menu);
    }

    menu.innerHTML = `
      <button type="button" data-tab="cases">🎁 Кейсы</button>
      <button type="button" data-tab="inventory">🎒 Инвентарь</button>
      <button type="button" data-tab="profile">👤 Профиль</button>
    `;

    menu.querySelectorAll("[data-tab]").forEach(button => {
      button.addEventListener("click", () => {
        showTab(button.dataset.tab);
      });
    });
  }

  function showTab(tab) {
    activeTab = tab;

    const topup = document.querySelector("#ludoman-topup");
    const cases = document.querySelector("#ludoman-cases");
    const animation = document.querySelector("#case-animation");

    if (topup) topup.classList.toggle("hidden", tab !== "cases");
    if (cases) cases.classList.toggle("hidden", tab !== "cases");

    if (animation) {
      animation.classList.toggle("hidden", tab !== "cases");
    }

    if (inventoryEl) {
      inventoryEl.classList.toggle("hidden", tab !== "inventory");
    }

    if (profileEl) {
      profileEl.classList.toggle("hidden", tab !== "profile");
    }

    document.querySelectorAll(".bottom-menu [data-tab]")
      .forEach(button => {
        button.classList.toggle("active", button.dataset.tab === tab);
      });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- БАЛАНС ----------

  function renderBalance() {
    if (balanceEl && player) {
      balanceEl.textContent = formatNumber(player.star_balance);
    }

    const topupBalance = document.querySelector("#topup-balance");

    if (topupBalance && player) {
      topupBalance.textContent = formatNumber(player.star_balance);
    }
  }

  // ---------- ИНВЕНТАРЬ ----------

  function renderInventory(items = []) {
    if (!inventoryEl) return;

    inventoryEl.innerHTML = `
      <div class="panel">
        <div class="section-title">
          <h3>🎒 Мой инвентарь</h3>
          <span class="muted">${items.length} шт.</span>
        </div>

        <p class="muted">
          Продавай полученные предметы и получай средства
          на внутренний баланс.
        </p>

        ${
          items.length
            ? items.map(item => {
                const price = Number(item.sell_price || 0);

                return `
                  <div class="item">
                    <div class="item-icon">
                      ${escapeHTML(getEmoji(item))}
                    </div>

                    <div class="item-info">
                      <strong>${escapeHTML(getName(item))}</strong>

                      <div class="muted">
                        ${escapeHTML(
                          item.description ||
                          item.desc ||
                          "Предмет из кейса"
                        )}
                      </div>

                      <span class="rarity">
                        ${escapeHTML(item.rarity || "НАГРАДА")}
                      </span>

                      <div class="item-actions">
                        ${
                          price > 0
                            ? `
                              <span class="sell-price">
                                ${formatNumber(price)} ⭐
                              </span>
                              <br><br>
                              <button
                                type="button"
                                class="sell-btn"
                                data-sell-id="${Number(item.id)}"
                              >
                                💰 Продать
                              </button>
                            `
                            : `
                              <span class="muted">
                                Продажа недоступна
                              </span>
                            `
                        }
                      </div>
                    </div>
                  </div>
                `;
              }).join("")
            : `
              <div class="empty-state">
                <div class="big-emoji">🎁</div>
                <strong>Инвентарь пока пуст</strong>
                <p>Открой кейс, чтобы получить первый предмет.</p>
                <button type="button" id="go-to-cases">
                  Открыть кейсы
                </button>
              </div>
            `
        }
      </div>
    `;

    inventoryEl.querySelector("#go-to-cases")
      ?.addEventListener("click", () => showTab("cases"));

    inventoryEl.querySelectorAll("[data-sell-id]")
      .forEach(button => {
        button.addEventListener("click", () => sellItem(button));
      });
  }

  async function sellItem(button) {
    if (busy) return;

    const itemId = Number(button.dataset.sellId);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      notify("Не удалось определить предмет.", true);
      return;
    }

    const item = player?.inventory?.find(
      entry => Number(entry.id) === itemId
    );

    if (!item) {
      notify("Предмет не найден. Обнови инвентарь.", true);
      return;
    }

    const price = Number(item.sell_price || 0);

    if (price <= 0) {
      notify("Этот предмет нельзя продать.", true);
      return;
    }

    const confirmed = typeof tg?.showConfirm === "function"
      ? await new Promise(resolve => {
          tg.showConfirm(
            `Продать «${getName(item)}» за ${price} ⭐?`,
            resolve
          );
        })
      : window.confirm(
          `Продать «${getName(item)}» за ${price} ⭐?`
        );

    if (!confirmed) return;

    busy = true;
    button.disabled = true;
    button.textContent = "Продаём...";

    try {
      const result = await api("/api/inventory/sell", {
        method: "POST",
        body: JSON.stringify({ item_id: itemId })
      });

      player.star_balance = Number(
        result.star_balance ?? player.star_balance
      );

      renderBalance();

      await refreshData();

      notify(
        `✅ Предмет продан! Начислено ${formatNumber(result.sold_for)} ⭐.`
      );

      try {
        tg?.HapticFeedback?.notificationOccurred("success");
      } catch {}
    } catch (error) {
      notify(error.message || "Не удалось продать предмет.", true);

      try {
        await refreshData();
      } catch {}
    } finally {
      busy = false;
    }
  }

  // ---------- ПРОФИЛЬ ----------

  function renderProfile() {
    if (!profileEl || !player) return;

    const user = player.user || {};

    const name = [
      user.first_name,
      user.last_name
    ].filter(Boolean).join(" ") ||
      user.username ||
      "Игрок";

    const stats = player.stats || {};

    profileEl.innerHTML = `
      <div class="panel">
        <h3>👤 Профиль игрока</h3>

        <div class="item">
          <div class="item-info">
            <span class="muted">Имя</span><br>
            <strong>${escapeHTML(name)}</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Telegram ID</span><br>
            <strong>${escapeHTML(user.id || "—")}</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Внутренний баланс</span><br>
            <strong>${formatNumber(player.star_balance)} ⭐</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Открыто кейсов</span><br>
            <strong>${formatNumber(stats.opens)}</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Потрачено Stars</span><br>
            <strong>${formatNumber(stats.spent)} ⭐</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Побед</span><br>
            <strong>${formatNumber(stats.wins)}</strong>
          </div>
        </div>

        <button id="leaderboard-btn" style="width:100%;margin-top:12px">
          🏆 Рейтинг игроков
        </button>

        <div id="leaderboard"></div>
      </div>
    `;

    profileEl.querySelector("#leaderboard-btn")
      ?.addEventListener("click", loadLeaderboard);
  }

  async function loadLeaderboard() {
    const target = profileEl?.querySelector("#leaderboard");

    if (!target) return;

    target.textContent = "Загружаем рейтинг...";

    try {
      const data = await api("/api/leaderboard");
      const rows = data.players || [];

      target.innerHTML = rows.length
        ? `
          <h3 class="tab-heading">🏆 Топ игроков</h3>
          ${rows.map((item, index) => `
            <div class="item">
              <div class="item-info">
                <strong>
                  ${index + 1}. ${escapeHTML(item.name || "Игрок")}
                </strong>
                <div class="muted">
                  Побед: ${formatNumber(item.wins)}
                  · Кейсов: ${formatNumber(item.opens)}
                </div>
              </div>
            </div>
          `).join("")}
        `
        : `<p class="muted">Пока нет участников рейтинга.</p>`;
    } catch (error) {
      target.textContent = error.message;
    }
  }

  // ---------- ЗАГРУЗКА ДАННЫХ ----------

  async function refreshData() {
    const data = await api("/api/me");

    player = {
      ...data,
      user: data.user || {},
      stats: data.stats || {},
      inventory: Array.isArray(data.inventory) ? data.inventory : [],
      star_balance: Number(data.star_balance || 0)
    };

    renderBalance();
    renderProfile();
    renderInventory(player.inventory);
  }

  // ---------- ПОПОЛНЕНИЕ STARS ----------

  function setupTopup() {
    const container = document.querySelector("#ludoman-topup");
    if (!container) return;

    container.innerHTML = `
      <div class="panel">
        <h3>⭐ Пополнение баланса</h3>

        <p class="muted">
          Выбери сумму от 50 до 10 000 Stars.
          После успешной оплаты баланс обновится.
        </p>

        <div class="topup-row">
          <button type="button" data-topup="50">50 ⭐</button>
          <button type="button" data-topup="100">100 ⭐</button>
          <button type="button" data-topup="250">250 ⭐</button>
          <button type="button" data-topup="500">500 ⭐</button>
        </div>

        <div class="custom-topup">
          <input
            id="custom-topup-amount"
            type="number"
            min="50"
            max="10000"
            step="1"
            placeholder="Другая сумма"
          >
          <button type="button" id="custom-topup-btn">
            Пополнить
          </button>
        </div>

        <p class="muted">
          Твой баланс:
          <strong id="topup-balance">0</strong> ⭐
        </p>
      </div>
    `;

    container.querySelectorAll("[data-topup]").forEach(button => {
      button.addEventListener("click", () => {
        createTopup(
          Number(button.dataset.topup),
          button
        );
      });
    });

    container.querySelector("#custom-topup-btn")
      ?.addEventListener("click", () => {
        const input = container.querySelector("#custom-topup-amount");

        createTopup(
          Number(input?.value),
          container.querySelector("#custom-topup-btn")
        );
      });
  }

  async function createTopup(amount, button) {
    if (busy) return;

    if (!Number.isInteger(amount) || amount < 50 || amount > 10000) {
      notify("Укажи целое число от 50 до 10 000 Stars.", true);
      return;
    }

    if (!tg?.ini
