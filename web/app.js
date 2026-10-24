document.addEventListener("DOMContentLoaded", async () => {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const app = document.querySelector("#app");
  const balanceEl = document.querySelector("#balance");
  const inventoryEl = document.querySelector("#inventory");
  const profileEl = document.querySelector("#profile");
  const animationEl = document.querySelector("#case-animation");

  let player = null;
  let busy = false;

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
      background: var(--bg);
      color: var(--text);
      font-family: Arial, sans-serif;
      padding-bottom: 30px;
    }

    .top-bar {
      padding: 18px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #303030;
      flex-wrap: wrap;
    }

    .top-bar h1 {
      font-size: 21px;
      margin: 0;
      font-weight: 900;
    }

    .top-bar h1 span {
      color: var(--lime);
    }

    .balance-box {
      background: #222;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 13px;
    }

    #balance {
      color: var(--lime);
      font-weight: bold;
    }

    main {
      max-width: 700px;
      margin: auto;
      padding: 14px;
    }

    h2 {
      font-size: 21px;
    }

    .cases {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: 12px;
    }

    .case-card, .panel {
      background: var(--panel);
      border: 1px solid #303030;
      border-radius: 16px;
      padding: 16px;
      box-sizing: border-box;
    }

    .case-card {
      text-align: center;
    }

    .case-card h3 {
      font-size: 16px;
    }

    .case-card p {
      color: var(--muted);
      font-size: 14px;
    }

    button {
      cursor: pointer;
      font-weight: bold;
      border: none;
      border-radius: 11px;
      padding: 12px;
      background: var(--lime);
      color: #101010;
    }

    button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .open-btn {
      width: 100%;
      font-size: 13px;
    }

    .bottom-menu {
      display: flex;
      gap: 10px;
      margin: 22px 0;
    }

    .bottom-menu button {
      flex: 1;
    }

    .panel {
      margin: 14px 0;
      overflow-wrap: anywhere;
    }

    .panel h3 {
      margin-top: 0;
    }

    .item {
      padding: 12px 0;
      border-bottom: 1px solid #333;
    }

    .item:last-child {
      border-bottom: none;
    }

    .muted {
      color: var(--muted);
      font-size: 13px;
    }

    .notice {
      padding: 14px;
      margin: 12px 0;
      border-radius: 12px;
      background: #252525;
      border: 1px solid #444;
      line-height: 1.5;
    }

    .notice.error {
      border-color: #ff5757;
    }

    #case-animation:empty {
      display: none;
    }

    .roulette {
      margin: 18px 0;
      padding: 15px;
      border: 1px solid #333;
      background: #171717;
      border-radius: 16px;
      overflow: hidden;
      text-align: center;
    }

    .roulette-track {
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .roulette-card {
      flex: 0 0 120px;
      min-height: 90px;
      border: 1px solid #444;
      background: #252525;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      overflow-wrap: anywhere;
      font-size: 13px;
    }

    .roulette-card .emoji {
      font-size: 30px;
    }

    .win {
      color: var(--lime);
      font-weight: bold;
      margin-top: 14px;
    }

    .hidden {
      display: none !important;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .small-btn {
      padding: 9px 12px;
      font-size: 12px;
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
        data.detail || data.message || "Ошибка обращения к серверу."
      );
    }

    return data;
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

  function rewardName(reward) {
    if (typeof reward === "string") return reward;

    return reward?.name ||
      reward?.title ||
      reward?.emoji ||
      "Награда";
  }

  function rewardEmoji(reward) {
    if (typeof reward === "string") {
      const match = reward.match(/^\p{Extended_Pictographic}/u);
      return match ? match[0] : "🎁";
    }

    return reward?.emoji || "🎁";
  }

  function rewardDescription(reward) {
    if (typeof reward === "string") return reward;

    const name = rewardName(reward);
    const emoji = rewardEmoji(reward);

    return name.startsWith(emoji) ? name : `${emoji} ${name}`;
  }

  function renderBalance() {
    if (balanceEl && player) {
      balanceEl.textContent = Number(player.balance || 0).toLocaleString("ru-RU");
    }
  }

  function renderInventory(items = []) {
    if (!inventoryEl) return;

    if (!items.length) {
      inventoryEl.innerHTML = `
        <div class="panel">
          <h3>🎒 Инвентарь</h3>
          <p class="muted">Пока здесь пусто. Открой свой первый кейс!</p>
        </div>
      `;
      return;
    }

    inventoryEl.innerHTML = `
      <div class="panel">
        <h3>🎒 Инвентарь</h3>
        ${items.map(item => {
          const reward = item.reward ?? item.item ?? item;
          const date = item.created_at
            ? new Date(item.created_at).toLocaleString("ru-RU")
            : "";

          return `
            <div class="item">
              <strong>${escapeHTML(rewardDescription(reward))}</strong>
              ${date ? `<div class="muted">${escapeHTML(date)}</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderProfile() {
    if (!profileEl || !player) return;

    const name = [
      player.first_name,
      player.last_name
    ].filter(Boolean).join(" ") || player.username || "Игрок";

    profileEl.innerHTML = `
      <div class="panel">
        <h3>👤 Профиль игрока</h3>
        <div class="item">
          <span class="muted">Имя</span><br>
          <strong>${escapeHTML(name)}</strong>
        </div>
        <div class="item">
          <span class="muted">Telegram ID</span><br>
          <strong>${escapeHTML(player.telegram_id ?? "—")}</strong>
        </div>
        <div class="item">
          <span class="muted">Открыто кейсов</span><br>
          <strong>${Number(player.opens || 0)}</strong>
        </div>
        <div class="item">
          <span class="muted">Потрачено монет</span><br>
          <strong>${Number(player.spent || 0).toLocaleString("ru-RU")} 🪙</strong>
        </div>
        <div class="item">
          <span class="muted">Побед</span><br>
          <strong>${Number(player.wins || 0)}</strong>
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

    // Поддерживаем оба варианта: данные игрока внутри user
    // или непосредственно в корне ответа.
    player = {
      ...(data.user || {}),
      ...data,
      ...(data.player || {})
    };

    if (data.user && data.telegram_id == null) {
      player.telegram_id = data.user.id ?? data.user.telegram_id;
    }

    player.inventory = data.inventory || player.inventory || [];

    renderBalance();
    renderProfile();
    renderInventory(player.inventory);
  }

  async function loadLeaderboard() {
    const target = document.querySelector("#leaderboard");
    if (!target) return;

    target.innerHTML = `<p class="muted">Загружаем рейтинг...</p>`;

    try {
      const data = await api("/api/leaderboard");
      const rows = Array.isArray(data) ? data : (data.leaderboard || []);

      if (!rows.length) {
        target.innerHTML = `<p class="muted">Пока нет участников рейтинга.</p>`;
        return;
      }

      target.innerHTML = `
        <h3>🏆 Топ игроков</h3>
        ${rows.map((item, index) => {
          const name = item.first_name ||
            item.username ||
            `Игрок ${item.telegram_id ?? ""}`;

          return `
            <div class="item">
              <strong>${index + 1}. ${escapeHTML(name)}</strong>
              <div class="muted">
                Побед: ${Number(item.wins || 0)}
                · Кейсов: ${Number(item.opens || 0)}
              </div>
            </div>
          `;
        }).join("")}
      `;
    } catch (error) {
      target.innerHTML = `
        <p class="muted">${escapeHTML(error.message)}</p>
      `;
    }
  }

  function showOpening(reward) {
    if (!animationEl) return Promise.resolve();

    const emoji = rewardEmoji(reward);
    const name = rewardName(reward);

    animationEl.innerHTML = `
      <div class="roulette">
        <h3>🎰 Открытие кейса</h3>
        <div class="roulette-track">
          <div class="roulette-card">
            <span class="emoji">🎁</span>
            <span>Открываем...</span>
          </div>
        </div>
        <div class="muted">Определяем результат...</div>
      </div>
    `;

    const track = animationEl.querySelector(".roulette-track");
    const roulette = animationEl.querySelector(".roulette");

    const items = Array.from({ length: 17 }, (_, i) => {
      if (i === 15) {
        return { emoji, name };
      }

      const decorations = ["🎁", "💎", "⚡", "👑", "🔥", "🐉", "🪙"];
      return {
        emoji: decorations[Math.floor(Math.random() * decorations.length)],
        name: "Награда"
      };
    });

    track.innerHTML = items.map(item => `
      <div class="roulette-card">
        <span class="emoji">${item.emoji}</span>
        <span>${escapeHTML(item.name)}</span>
      </div>
    `).join("");

    const cards = track.querySelectorAll(".roulette-card");
    const winningCard = cards[15];

    const distance =
      winningCard.offsetLeft +
      winningCard.offsetWidth / 2 -
      track.clientWidth / 2;

    track.style.justifyContent = "flex-start";
    track.style.width = "max-content";
    track.style.transform = "translateX(0)";

    return new Promise(resolve => {
      track.animate(
        [
          { transform: "translateX(0)" },
          { transform: `translateX(-${Math.max(0, distance)}px)` }
        ],
        {
          duration: 4500,
          easing: "cubic-bezier(.08,.65,.12,1)",
          fill: "forwards"
        }
      ).onfinish = () => {
        roulette.innerHTML = `
          <h3>🎉 Поздравляем!</h3>
          <div style="font-size:55px;margin:18px">${escapeHTML(emoji)}</div>
          <div class="win">${escapeHTML(name)}</div>
          <p class="muted">Награда сохранена на сервере.</p>
          <button id="close-result" style="width:100%;margin-top:12px">
            Отлично!
          </button>
        `;

        roulette.querySelector("#close-result")
          ?.addEventListener("click", () => {
            animationEl.innerHTML = "";
          });

        try {
          tg?.HapticFeedback?.notificationOccurred("success");
        } catch {}

        resolve();
      };
    });
  }

  async function openCase(button) {
    if (busy) return;

    const price = Number(button.dataset.price);

    if (![100, 250, 500].includes(price)) {
      notify("Неизвестная стоимость кейса.", true);
      return;
    }

    if (!player) {
      notify("Сначала дождись загрузки профиля.", true);
      return;
    }

    if (Number(player.balance) < price) {
      notify("Недостаточно монет для открытия кейса.", true);
      return;
    }

    busy = true;
    clearNotice();

    document.querySelectorAll(".open-btn").forEach(btn => {
      btn.disabled = true;
    });

    try {
      // Сервер сам списывает монеты и выбирает награду.
      const result = await api("/api/open", {
        method: "POST",
        body: JSON.stringify({ price })
      });

      if (!result.reward) {
        throw new Error("Сервер не вернул награду. Обнови приложение.");
      }

      player.balance = result.balance;
      renderBalance();

      await showOpening(result.reward);

      // Получаем актуальные профиль и инвентарь из базы.
      await refreshData();

    } catch (error) {
      notify(error.message || "Не удалось открыть кейс.", true);

      // Перезагружаем баланс, если сервер мог обработать запрос.
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

  document.querySelectorAll(".open-btn[data-price]").forEach(button => {
    button.addEventListener("click", () => openCase(button));
  });

  document.querySelector("#inventory-btn")?.addEventListener("click", () => {
    inventoryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("#profile-btn")?.addEventListener("click", () => {
    profileEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  // Покупка кейсов за Telegram Stars
  document.querySelectorAll(".star-case-btn").forEach(button => {
    button.addEventListener("click", async () => {
      if (busy) return;

      if (!tg?.initData) {
        notify("Открой приложение через Telegram.", true);
        return;
      }

      const caseId = button.dataset.caseId;
      const prices = {
        start: 1,
        pro: 100,
        vip: 250
      };

      if (!prices[caseId]) {
        notify("Неизвестный кейс.", true);
        return;
      }

      if (typeof tg.openInvoice !== "function") {
        notify(
          "Оплата доступна только в поддерживаемом приложении Telegram.",
          true
        );
        return;
      }

      busy = true;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Создаём счёт...";

      try {
        const result = await api("/api/star/create", {
          method: "POST",
          body: JSON.stringify({ case_id: caseId })
        });

        if (!result.invoice_url) {
          throw new Error("Сервер не вернул ссылку на оплату.");
        }

        button.textContent = "Ожидаем оплату...";

        tg.openInvoice(result.invoice_url, async status => {
          busy = false;
          button.disabled = false;
          button.textContent = originalText;

          if (status === "paid") {
            notify(
              "Оплата принята! Проверяем выдачу подарка. 🎁"
            );
          } else if (status === "cancelled") {
            notify("Оплата отменена.");
          } else if (status === "failed") {
            notify("Оплата не прошла. Попробуй ещё раз.", true);
          }
        });
      } catch (error) {
        busy = false;
        button.disabled = false;
        button.textContent = originalText;
        notify(error.message || "Не удалось создать счёт.", true);
      }
    });
  });
  if (!tg?.initData) {
    notify("Открой LUDOMAN CASE через Telegram, чтобы загрузить свой профиль.", true);
    document.querySelectorAll(".open-btn").forEach(btn => {
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
      " Проверь настройки Render и подключение базы данных.",
      true
    );
  }
});
                          
