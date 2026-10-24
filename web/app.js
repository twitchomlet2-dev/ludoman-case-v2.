
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
    }

    body {
      margin: 0;
      padding-bottom: 30px;
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
      border-bottom: 1px solid #303030;
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

    .cases {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }

    .case-card,
    .panel {
      padding: 16px;
      background: var(--panel);
      border: 1px solid #303030;
      border-radius: 16px;
      box-sizing: border-box;
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
      box-sizing: border-box;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #444;
      background: #111;
      color: white;
    }

    .item {
      padding: 12px 0;
      border-bottom: 1px solid #333;
    }

    .item:last-child {
      border-bottom: none;
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
      border-color: #ff5757;
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
      display: flex;
      gap: 10px;
      margin: 20px 0;
    }

    .bottom-menu button {
      flex: 1;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
  `;
  document.head.appendChild(style);

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

  function renderBalance() {
    if (balanceEl && player) {
      balanceEl.textContent =
        Number(player.star_balance || 0).toLocaleString("ru-RU");
    }

    const topupBalance = document.querySelector("#topup-balance");
    if (topupBalance && player) {
      topupBalance.textContent =
        Number(player.star_balance || 0).toLocaleString("ru-RU");
    }
  }

  function renderInventory(items = []) {
    if (!inventoryEl) return;

    inventoryEl.innerHTML = `
      <div class="panel">
        <h3>🎒 Инвентарь</h3>
        ${
          items.length
            ? items.map(item => `
                <div class="item">
                  <strong>
                    ${escapeHTML(getEmoji(item))}
                    ${escapeHTML(getName(item))}
                  </strong>
                  <div class="muted">
                    ${escapeHTML(item.description || item.desc || item.rarity || "")}
                  </div>
                  ${
                    item.date || item.created_at
                      ? `<div class="muted">${escapeHTML(
                          new Date(item.date || item.created_at)
                            .toLocaleString("ru-RU")
                        )}</div>`
                      : ""
                  }
                </div>
              `).join("")
            : `<p class="muted">Инвентарь пока пуст. Открой первый кейс!</p>`
        }
      </div>
    `;
  }

  function renderProfile() {
    if (!profileEl || !player) return;

    const user = player.user || {};
    const name = [
      user.first_name || player.first_name,
      user.last_name || player.last_name
    ].filter(Boolean).join(" ") || user.username || "Игрок";

    const stats = player.stats || {};

    profileEl.innerHTML = `
      <div class="panel">
        <h3>👤 Профиль игрока</h3>
        <div class="item">
          <span class="muted">Имя</span><br>
          <strong>${escapeHTML(name)}</strong>
        </div>
        <div class="item">
          <span class="muted">Telegram ID</span><br>
          <strong>${escapeHTML(user.id || player.telegram_id || "—")}</strong>
        </div>
        <div class="item">
          <span class="muted">Открыто кейсов</span><br>
          <strong>${Number(stats.opens ?? player.opens ?? 0)}</strong>
        </div>
        <div class="item">
          <span class="muted">Потрачено Stars</span><br>
          <strong>${Number(stats.spent ?? player.spent ?? 0).toLocaleString("ru-RU")} ⭐</strong>
        </div>
        <div class="item">
          <span class="muted">Побед</span><br>
          <strong>${Number(stats.wins ?? player.wins ?? 0)}</strong>
        </div>
        <button id="leaderboard-btn" style="width:100%;margin-top:12px">
          🏆 Рейтинг игроков
        </button>
        <div id="leaderboard"></div>
      </div>
    `;

    document.querySelector("#leaderboard-btn")
      ?.addEventListener("click", loadLeaderboard);
  }

  async function refreshData() {
    const data = await api("/api/me");

    player = {
      ...data,
      user: data.user || {},
      stats: data.stats || {},
      inventory: data.inventory || [],
      star_balance: Number(data.star_balance || 0)
    };

    renderBalance();
    renderProfile();
    renderInventory(player.inventory);
  }

  async function loadLeaderboard() {
    const target = document.querySelector("#leaderboard");
    if (!target) return;

    target.textContent = "Загружаем рейтинг...";

    try {
      const data = await api("/api/leaderboard");
      const rows = data.players || data.leaderboard || [];

      target.innerHTML = rows.length
        ? `<h3>🏆 Топ игроков</h3>` + rows.map((item, index) => `
            <div class="item">
              <strong>
                ${index + 1}. ${escapeHTML(
                  item.name || item.first_name || item.username || "Игрок"
                )}
              </strong>
              <div class="muted">
                Побед: ${Number(item.wins || 0)}
                · Кейсов: ${Number(item.opens || 0)}
              </div>
            </div>
          `).join("")
        : `<p class="muted">Пока нет участников рейтинга.</p>`;
    } catch (error) {
      target.textContent = error.message;
    }
  }

  function setupTopup() {
    let panel = document.querySelector("#topup-panel");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "topup-panel";
      panel.className = "panel";
      panel.innerHTML = `
        <h3>⭐ Пополнение баланса</h3>
        <p class="muted">
          Выбери сумму от 50 до 10 000 Stars.
          После успешной оплаты Stars будут зачислены на внутренний баланс.
        </p>
        <div class="topup-row">
          <button data-topup="50">50 ⭐</button>
          <button data-topup="100">100 ⭐</button>
          <button data-topup="250">250 ⭐</button>
          <button data-topup="500">500 ⭐</button>
        </div>
        <div class="custom-topup">
          <input id="custom-topup-amount" type="number"
            min="50" max="10000" step="1" placeholder="Другая сумма">
          <button id="custom-topup-btn">Пополнить</button>
        </div>
        <p class="muted">Баланс: <strong id="topup-balance">0</strong> ⭐</p>
      `;

      const cases = document.querySelector(".cases");
      if (cases) {
        cases.insertAdjacentElement("beforebegin", panel);
      } else {
        app.appendChild(panel);
      }
    }

    panel.querySelectorAll("[data-topup]").forEach(button => {
      button.addEventListener("click", () => {
        createTopup(Number(button.dataset.topup), button);
      });
    });

    panel.querySelector("#custom-topup-btn")
      ?.addEventListener("click", () => {
        const input = panel.querySelector("#custom-topup-amount");
        createTopup(Number(input?.value), panel.querySelector("#custom-topup-btn"));
      });
  }

  async function createTopup(amount, button) {
    if (busy) return;

    if (!Number.isInteger(amount) || amount < 50 || amount > 10000) {
      notify("Укажи сумму целым числом от 50 до 10 000 Stars.", true);
      return;
    }

    if (!tg?.initData || typeof tg.openInvoice !== "function") {
      notify("Оплата доступна при открытии приложения через Telegram.", true);
      return;
    }

    busy = true;
    const originalText = button?.textContent || "Пополнить";
    if (button) {
      button.disabled = true;
      button.textContent = "Создаём счёт...";
    }

    try {
      const result = await api("/api/star/topup", {
        method: "POST",
        body: JSON.stringify({ amount })
      });

      if (!result.invoice_url) {
        throw new Error("Сервер не вернул ссылку на оплату.");
      }

      if (button) button.textContent = "Ожидаем оплату...";

      tg.openInvoice(result.invoice_url, async status => {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }

        busy = false;

        if (status === "paid") {
          notify("Оплата завершена. Обновляем баланс...");
          try {
            await refreshData();
            notify("Баланс обновлён. Спасибо за пополнение! ⭐");
          } catch {
            notify("Оплата прошла. Открой приложение заново, чтобы обновить баланс.");
          }
        } else if (status === "cancelled") {
          notify("Оплата отменена.");
        } else if (status === "failed") {
          notify("Оплата не прошла. Попробуй ещё раз.", true);
        }
      });
    } catch (error) {
      busy = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
      notify(error.message || "Не удалось создать счёт.", true);
    }
  }

  function setupCases() {
    let section = document.querySelector("#ludoman-cases");

    if (!section) {
      section = document.createElement("section");
      section.id = "ludoman-cases";
      section.innerHTML = `
        <h2>🎰 Кейсы</h2>
        <p class="muted">
          Открытие списывает Stars с внутреннего баланса.
        </p>
        <div class="cases" id="ludoman-case-list"></div>
      `;

      const topup = document.querySelector("#topup-panel");
      if (topup) {
        topup.insertAdjacentElement("afterend", section);
      } else {
        app.appendChild(section);
      }
    }

    const list = section.querySelector("#ludoman-case-list");
    if (!list) return;

    list.innerHTML = CASES.map(item => `
      <div class="case-card">
        <div class="case-emoji">${item.emoji}</div>
        <h3>${escapeHTML(item.name)}</h3>
        <p>Цена: ${item.price} ⭐</p>
        <button class="open-btn" data-price="${item.price}">
          Открыть кейс
        </button>
      </div>
    `).join("");

    list.querySelectorAll(".open-btn").forEach(button => {
      button.addEventListener("click", () => openCase(button));
    });
  }

  async function openCase(button) {
    if (busy) return;

    if (!player) {
      notify("Сначала загрузи профиль.", true);
      return;
    }

    const price = Number(button.dataset.price);

    if (!CASES.some(item => item.price === price)) {
      notify("Неизвестный кейс.", true);
      return;
    }

    if (Number(player.star_balance || 0) < price) {
      notify("Недостаточно Stars. Сначала пополни баланс.", true);
      return;
    }

    busy = true;
    clearNotice();
    document.querySelectorAll(".open-btn").forEach(btn => {
      btn.disabled = true;
    });

    try {
      const result = await api("/api/open", {
        method: "POST",
        body: JSON.stringify({ price })
      });

      if (!result.reward) {
        throw new Error("Сервер не вернул награду.");
      }

      player.star_balance = Number(
        result.star_balance ?? result.balance ?? 0
      );
      renderBalance();

      await showOpening(result.reward);
      await refreshData();
    } catch (error) {
      notify(error.message || "Не удалось открыть кейс.", true);
      try {
        await refreshData();
      } catch {}
    } finally {
      busy = false;
      document.querySelectorAll(".open-btn").forEach(btn => {
        btn.disabled = false;
      });
    }
  }

  function showOpening(reward) {
    if (!animationEl) {
      notify(`Твоя награда: ${getEmoji(reward)} ${getName(reward)}`);
      return Promise.resolve();
    }

    const emoji = getEmoji(reward);
    const name = getName(reward);

    animationEl.innerHTML = `
      <div class="roulette">
        <h3>🎰 Результат открытия</h3>
        <div style="font-size:56px;margin:20px">
          🎁
        </div>
        <p class="muted">Открываем кейс...</p>
      </div>
    `;

    return new Promise(resolve => {
      window.setTimeout(() => {
        animationEl.innerHTML = `
          <div class="roulette">
            <h3>🎉 Поздравляем!</h3>
            <div style="font-size:56px;margin:20px">
              ${escapeHTML(emoji)}
            </div>
            <div class="win">${escapeHTML(name)}</div>
            <p class="muted">Награда сохранена на сервере.</p>
            <button id="close-result" style="width:100%">
              Отлично!
            </button>
          </div>
        `;

        animationEl.querySelector("#close-result")
          ?.addEventListener("click", () => {
            animationEl.innerHTML = "";
          });

        try {
          tg?.HapticFeedback?.notificationOccurred("success");
        } catch {}

        resolve();
      }, 1400);
    });
  }

  document.querySelector("#inventory-btn")
    ?.addEventListener("click", () => {
      inventoryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

  document.querySelector("#profile-btn")
    ?.addEventListener("click", () => {
      profileEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

  setupTopup();
  setupCases();

  if (!tg?.initData) {
    notify("Открой LUDOMAN Case через Telegram, чтобы загрузить профиль.", true);
    document.querySelectorAll(".open-btn").forEach(btn => {
      btn.disabled = true;
    });
    document.querySelectorAll("[data-topup], #custom-topup-btn")
      .forEach(btn => {
        btn.disabled = true;
      });
    return;
  }

  try {
    await refreshData();
    clearNotice();
  } catch (error) {
    notify(
      "Не удалось загрузить профиль: " + error.message +
      ". Проверь Render и подключение базы данных.",
      true
    );
  }
});
  
