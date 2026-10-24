
document.addEventListener("DOMContentLoaded", async () => {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor("#101010");
      tg.setBackgroundColor("#101010");
    } catch {}
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let player = null;
  let busy = false;

  const CASES = [
    { price: 50, name: "Старт", emoji: "🎁" },
    { price: 100, name: "Про", emoji: "💎" },
    { price: 250, name: "VIP", emoji: "👑" },
    { price: 500, name: "Легенда", emoji: "🐉" }
  ];

  const style = document.createElement("style");
  style.textContent = `
    :root {
      --lime: #c6ff00;
      --bg: #101010;
      --panel: #1b1b1b;
      --text: #f5f5f5;
      --muted: #999;
      --border: #303030;
    }

    * { box-sizing: border-box; }

    html { background: var(--bg); }

    body {
      margin: 0;
      padding: 0 0 calc(88px + env(safe-area-inset-bottom));
      background: var(--bg);
      color: var(--text);
      font-family: Arial, sans-serif;
    }

    #app {
      max-width: 760px;
      margin: auto;
      min-height: 100vh;
    }

    .top-bar {
      padding: 18px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border);
    }

    .top-bar h1 {
      margin: 0;
      font-size: 21px;
      font-weight: 900;
    }

    .top-bar h1 span, #balance { color: var(--lime); }

    .balance-box {
      padding: 11px 12px;
      background: #222;
      border-radius: 12px;
      font-size: 13px;
    }

    main { padding: 0 0 15px; }

    h2 { font-size: 21px; }
    h3 { margin-top: 0; }

    #ludoman-topup, #ludoman-cases, #case-animation,
    #inventory, #profile {
      padding: 0 14px;
    }

    #ludoman-topup { padding-top: 14px; }

    .panel, .case-card {
      padding: 16px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 16px;
      min-width: 0;
    }

    .panel { margin: 14px 0; overflow-wrap: anywhere; }

    .cases {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .case-card { text-align: center; }
    .case-emoji { font-size: 42px; }
    .case-card h3 { margin: 10px 0; }
    .case-card p, .muted {
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
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
    }

    button:disabled { opacity: .45; cursor: not-allowed; }
    .open-btn { width: 100%; }

    .topup-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    .topup-row button { width: 100%; }

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

    .item:last-child { border-bottom: none; }

    .item-icon {
      width: 50px;
      height: 50px;
      flex: 0 0 50px;
      display: grid;
      place-items: center;
      background: #262626;
      border: 1px solid #393939;
      border-radius: 14px;
      font-size: 27px;
    }

    .item-info { flex: 1; min-width: 0; }
    .item-info strong { overflow-wrap: anywhere; }

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

    .sell-price { color: var(--lime); font-weight: bold; }
    .sell-btn { margin-top: 8px; padding: 9px 12px; }

    .notice {
      padding: 13px;
      margin: 12px 14px;
      border-radius: 12px;
      background: #252525;
      border: 1px solid #444;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .notice.error { border-color: #ff5757; }
    .hidden { display: none !important; }

    .roulette {
      margin: 18px 0;
      padding: 16px;
      text-align: center;
      background: #171717;
      border: 1px solid #333;
      border-radius: 16px;
    }

    .win { color: var(--lime); font-weight: bold; margin: 14px 0; }

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
      padding-bottom: max(10px, env(safe-area-inset-bottom));
      background: #101010;
      border-top: 1px solid #303030;
    }

    .bottom-menu button {
      padding: 12px 4px;
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

    .empty-state { padding: 25px 10px; text-align: center; color: var(--muted); }
    .big-emoji { font-size: 46px; margin-bottom: 10px; }

    @media (max-width: 360px) {
      .top-bar h1 { font-size: 18px; }
      .cases { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c]);
  }

  function number(value) {
    return Number(value || 0).toLocaleString("ru-RU");
  }

  function notify(message, error = false) {
    const el = $("#app-notice");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", error);
    el.classList.remove("hidden");
  }

  function clearNotice() {
    const el = $("#app-notice");
    if (el) el.classList.add("hidden");
  }

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
      throw new Error(data.detail || data.message || "Ошибка сервера.");
    }

    return data;
  }

  function getEmoji(item) {
    return item?.icon || item?.emoji || "🎁";
  }

  function getName(item) {
    return item?.name || item?.title || "Награда";
  }

  // Навигация скрывает целые вкладки, но не удаляет их содержимое.
  function showTab(name) {
    $$(".tab-content").forEach(section => section.classList.add("hidden"));

    const target = $(`#${name}-tab`);
    if (target) target.classList.remove("hidden");

    $$(".bottom-menu [data-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === name);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$(".bottom-menu [data-tab]").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });

  // Пополнение
  function renderTopup() {
    const container = $("#ludoman-topup");
    if (!container) return;

    container.innerHTML = `
      <div class="panel">
        <h3>⭐ Пополнение баланса</h3>
        <p class="muted">
          Выбери сумму. Оплата выполняется через Telegram Stars.
          Диапазон: от 50 до 10 000 Stars.
        </p>
        <div class="topup-row">
          <button type="button" data-topup="50">50 ⭐</button>
          <button type="button" data-topup="100">100 ⭐</button>
          <button type="button" data-topup="250">250 ⭐</button>
          <button type="button" data-topup="500">500 ⭐</button>
        </div>
        <div class="custom-topup">
          <input id="custom-topup-amount" type="number" min="50"
            max="10000" step="1" placeholder="Другая сумма">
          <button type="button" id="custom-topup-btn">Пополнить</button>
        </div>
        <p class="muted">
          Баланс: <strong id="topup-balance">0</strong> ⭐
        </p>
      </div>
    `;

    $$("[data-topup]", container).forEach(button => {
      button.addEventListener("click", () => {
        createTopup(Number(button.dataset.topup), button);
      });
    });

    $("#custom-topup-btn", container).addEventListener("click", () => {
      createTopup(Number($("#custom-topup-amount", container).value),
        $("#custom-topup-btn", container));
    });
  }

  async function createTopup(amount, button) {
    if (busy) return;

    if (!Number.isInteger(amount) || amount < 50 || amount > 10000) {
      notify("Введи целую сумму от 50 до 10 000 Stars.", true);
      return;
    }

    if (!tg?.initData || typeof tg.openInvoice !== "function") {
      notify("Открой приложение через Telegram для оплаты.", true);
      return;
    }

    busy = true;
    const original = button?.textContent || "Пополнить";
    if (button) {
      button.disabled = true;
      button.textContent = "Создаём счёт...";
    }

    try {
      const result = await api("/api/star/topup", {
        method: "POST",
        body: JSON.stringify({ amount })
      });

      if (!result.invoice_url) throw new Error("Нет ссылки на оплату.");

      tg.openInvoice(result.invoice_url, async status => {
        busy = false;
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }

        if (status === "paid") {
          notify("Оплата завершена. Проверяем зачисление...");
          try {
            await refreshData();
            notify("Проверка завершена. Если баланс не изменился, подожди несколько секунд и обнови профиль.");
          } catch {
            notify("Оплата прошла. Перезапусти приложение, чтобы обновить баланс.");
          }
        } else if (status === "cancelled") {
          notify("Оплата отменена.");
        } else if (status === "failed") {
          notify("Оплата не прошла.", true);
        }
      });
    } catch (error) {
      busy = false;
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
      notify(error.message, true);
    }
  }

  // Кейсы
  function renderCases() {
    const section = $("#ludoman-cases");
    if (!section) return;

    section.innerHTML = `
      <h2>🎰 Кейсы LUDOMAN</h2>
      <p class="muted">Выбирай кейс и получай коллекционные предметы.</p>
      <div class="cases">
        ${CASES.map(item => `
          <div class="case-card">
            <div class="case-emoji">${item.emoji}</div>
            <h3>${escapeHTML(item.name)}</h3>
            <p>Цена: ${item.price} ⭐</p>
            <button type="button" class="open-btn" data-price="${item.price}">
              Открыть кейс
            </button>
          </div>
        `).join("")}
      </div>
    `;

    $$(".open-btn", section).forEach(button => {
      button.addEventListener("click", () => openCase(button));
    });
  }

  async function openCase(button) {
    if (busy) return;
    if (!player) {
      notify("Профиль ещё загружается.", true);
      return;
    }

    const price = Number(button.dataset.price);

    if (!CASES.some(item => item.price === price)) {
      notify("Неизвестный кейс.", true);
      return;
    }

    if (player.star_balance < price) {
      notify("Недостаточно средств. Пополни баланс.", true);
      showTab("cases");
      return;
    }

    busy = true;
    clearNotice();
    $$(".open-btn").forEach(btn => btn.disabled = true);

    try {
      const result = await api("/api/open", {
        method: "POST",
        body: JSON.stringify({ price })
      });

      if (!result.reward) throw new Error("Сервер не вернул награду.");

      player.star_balance = Number(result.star_balance ?? result.balance ?? 0);
      renderBalance();
      await showReward(result.reward);
      await refreshData();
    } catch (error) {
      notify(error.message || "Не удалось открыть кейс.", true);
      try { await refreshData(); } catch {}
    } finally {
      busy = false;
      $$(".open-btn").forEach(btn => btn.disabled = false);
    }
  }

  function showReward(reward) {
    const target = $("#case-animation");
    if (!target) return Promise.resolve();

    target.innerHTML = `
      <div class="roulette">
        <h3>🎰 Открываем кейс...</h3>
        <div style="font-size:55px;margin:20px">🎁</div>
        <p class="muted">Подготавливаем награду</p>
      </div>
    `;

    return new Promise(resolve => {
      window.setTimeout(() => {
        target.innerHTML = `
          <div class="roulette">
            <h3>🎉 Твоя награда!</h3>
            <div style="font-size:60px;margin:20px">
              ${escapeHTML(getEmoji(reward))}
            </div>
            <div class="win">${escapeHTML(getName(reward))}</div>
            <p class="muted">Предмет сохранён в инвентаре.</p>
            <button type="button" id="result-close" style="width:100%">
              Отлично!
            </button>
            <button type="button" id="result-inventory"
              style="width:100%;margin-top:8px;background:#292929;color:white">
              🎒 Перейти в инвентарь
            </button>
          </div>
        `;

        $("#result-close", target).addEventListener("click", () => {
          target.innerHTML = "";
        });

        $("#result-inventory", target).addEventListener("click", () => {
          target.innerHTML = "";
          showTab("inventory");
        });

        try { tg?.HapticFeedback?.notificationOccurred("success"); } catch {}
        resolve();
      }, 1000);
    });
  }

  // Инвентарь
  function renderInventory(items = []) {
    const target = $("#inventory");
    if (!target) return;

    target.innerHTML = `
      <div class="panel">
        <h3>🎒 Мой инвентарь</h3>
        <p class="muted">Продай предмет, чтобы получить средства на внутренний баланс.</p>

        ${
          items.length
            ? items.map(item => {
                const price = Number(item.sell_price || 0);

                return `
                  <div class="item">
                    <div class="item-icon">${escapeHTML(getEmoji(item))}</div>
                    <div class="item-info">
                      <strong>${escapeHTML(getName(item))}</strong>
                      <div class="muted">
                        ${escapeHTML(item.desc || item.description || "")}
                      </div>
                      <span class="rarity">${escapeHTML(item.rarity || "НАГРАДА")}</span>
                      <div style="margin-top:8px">
                        ${
                          price > 0
                            ? `
                              <span class="sell-price">${number(price)} ⭐</span><br>
                              <button type="button" class="sell-btn"
                                data-sell-id="${Number(item.id)}">
                                💰 Продать
                              </button>
                            `
                            : `<span class="muted">Продажа недоступна</span>`
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
                <button type="button" id="inventory-open-cases">
                  Открыть кейсы
                </button>
              </div>
            `
        }
      </div>
    `;

    $("#inventory-open-cases")?.addEventListener("click", () => showTab("cases"));

    $$(".sell-btn", target).forEach(button => {
      button.addEventListener("click", () => sellItem(button));
    });
  }

  async function sellItem(button) {
    if (busy) return;

    const itemId = Number(button.dataset.sellId);
    const item = player?.inventory?.find(entry => Number(entry.id) === itemId);

    if (!item || !Number.isInteger(itemId) || itemId <= 0) {
      notify("Предмет не найден. Обнови инвентарь.", true);
      return;
    }

    const price = Number(item.sell_price || 0);
    if (price <= 0) {
      notify("Этот предмет нельзя продать.", true);
      return;
    }

    let confirmed;

    if (typeof tg?.showConfirm === "function") {
      confirmed = await new Promise(resolve => {
        tg.showConfirm(`Продать «${getName(item)}» за ${price} ⭐?`, resolve);
      });
    } else {
      confirmed = window.confirm(`Продать «${getName(item)}» за ${price} ⭐?`);
    }

    if (!confirmed) return;

    busy = true;
    button.disabled = true;
    button.textContent = "Продаём...";

    try {
      const result = await api("/api/inventory/sell", {
        method: "POST",
        body: JSON.stringify({ item_id: itemId })
      });

      player.star_balance = Number(result.star_balance ?? player.star_balance);
      await refreshData();
      notify(`✅ Продано! Начислено ${number(result.sold_for)} ⭐.`);

      try { tg?.HapticFeedback?.notificationOccurred("success"); } catch {}
    } catch (error) {
      notify(error.message || "Не удалось продать предмет.", true);
      try { await refreshData(); } catch {}
    } finally {
      busy = false;
    }
  }

  // Профиль и рейтинг
  function renderProfile() {
    const target = $("#profile");
    if (!target || !player) return;

    const user = player.user || {};
    const stats = player.stats || {};
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
      || user.username || "Игрок";

    target.innerHTML = `
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
            <span class="muted">Баланс</span><br>
            <strong>${number(player.star_balance)} ⭐</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Открыто кейсов</span><br>
            <strong>${number(stats.opens)}</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Потрачено Stars</span><br>
            <strong>${number(stats.spent)} ⭐</strong>
          </div>
        </div>

        <div class="item">
          <div class="item-info">
            <span class="muted">Побед</span><br>
            <strong>${number(stats.wins)}</strong>
          </div>
        </div>

        <button type="button" id="leaderboard-btn" style="width:100%;margin-top:12px">
          🏆 Рейтинг игроков
        </button>
        <div id="leaderboard"></div>
      </div>
    `;

    $("#leaderboard-btn", target).addEventListener("click", loadLeaderboard);
  }

  async function loadLeaderboard() {
    const target = $("#leaderboard");
    if (!target) return;

    target.textContent = "Загружаем рейтинг...";

    try {
      const data = await api("/api/leaderboard");
      
      const players = Array.isArray(data)
        ? data
        : (data.players || []);

      target.innerHTML = `
        <div class="panel" style="margin-top:12px">
          <h3>🏆 Рейтинг игроков</h3>
          ${
            players.length
              ? players.map((item, index) => `
                  <div class="item">
                    <div class="item-info">
                      <strong>${index + 1}. ${
                        escapeHTML(item.first_name || item.username || item.name || "Игрок")
                      }</strong>
                    </div>
                    <strong>${number(item.opens || 0)} кейсов</strong>
                  </div>
                `).join("")
              : '<p class="muted">Пока игроков нет.</p>'
          }
        </div>
      `;
    } catch (error) {
      target.textContent = error.message || "Не удалось загрузить рейтинг.";
    }
  }

  function renderBalance() {
    const balance = Number(player?.star_balance || 0);
    const headerBalance = $("#balance");
    const topupBalance = $("#topup-balance");

    if (headerBalance) headerBalance.textContent = number(balance);
    if (topupBalance) topupBalance.textContent = number(balance);
  }

  async function refreshData() {
    const data = await api("/api/me");
    player = data;

    if (data.user && data.star_balance === undefined) {
      player.star_balance = Number(data.balance || 0);
    }

    renderBalance();
    renderProfile();
    renderInventory(Array.isArray(data.inventory) ? data.inventory : []);
  }

  renderTopup();
  renderCases();
  showTab("cases");

  if (!tg?.initData) {
    notify("Открой LUDOMAN CASE через Telegram, чтобы загрузить профиль и играть.");
    renderInventory([]);
  } else {
    try {
      await refreshData();
    } catch (error) {
      notify(error.message || "Не удалось загрузить профиль.", true);
    }
  }
});

      
