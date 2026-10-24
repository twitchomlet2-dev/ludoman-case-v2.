
document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#090a09");
    tg.setBackgroundColor("#090a09");
  }

  const CASES = [
    { price: 5, name: "STARTER", emoji: "🎁", description: "Первый шанс", image: "/static/images/12fb95be91b9565c4c90ad607b08d797.jpg" },
    { price: 49, name: "BASIC", emoji: "📦", description: "Начни открытие", image: "/static/images/5167e17dced4798e09dc799f09ceaf89.jpg" },
    { price: 249, name: "CRYSTAL", emoji: "💎", description: "Больше ценности", image: "/static/images/5832342cfe01033a2b4c091547287327.jpg" },
    { price: 499, name: "MYSTIC", emoji: "🔮", description: "Тайна внутри", image: "/static/images/9a82490c9bfd5f4d1b6466cd21cec355.jpg" },
    { price: 999, name: "ROYAL", emoji: "👑", description: "Королевский кейс", image: "/static/images/a88eab51721dd3a034c445b8d4da1025.jpg" },
    { price: 1499, name: "FIRE", emoji: "🔥", description: "Жаркие награды", image: "/static/images/b5d936ac85bb9fece68c6311b25bfecb.jpg" },
    { price: 2499, name: "DRAGON", emoji: "🐉", description: "Сила дракона", image: "/static/images/b65323d48230d096f54e5358dd245fcf.jpg" },
    { price: 4999, name: "LEGEND", emoji: "⚡", description: "Для настоящих легенд", image: "/static/images/e1948559d67e32bea2013f0c935026b2.jpg" }
  ];

  const $ = (selector) => document.querySelector(selector);

  let currentBalance = 0;
  let selectedTopup = 100;
  let busy = false;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("ru-RU") : "0";
  }

  function notify(message, type = "info") {
    const notice = $("#app-notice");
    if (!notice) return;

    notice.textContent = message;
    notice.classList.remove("hidden", "error-text");

    if (type === "error") notice.classList.add("error-text");

    if (type === "success" && tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred("success");
    }

    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      notice.classList.add("hidden");
    }, 4500);
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(tg?.initData
        ? { "X-Telegram-Init-Data": tg.initData }
        : {}),
      ...(options.headers || {})
    };

    const response = await fetch(path, { ...options, headers });
    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.detail || data.message || "Ошибка сервера");
    }

    return data;
  }

  function requireTelegram() {
    if (!tg?.initData) {
      notify(
        "Открой приложение через Telegram, чтобы пользоваться балансом, кейсами и оплатой.",
        "error"
      );
      return false;
    }
    return true;
  }

  function renderCases() {
    const target = $("#ludoman-cases");
    if (!target) return;

    target.innerHTML = `
      <h2 class="page-heading">Открывай <span class="highlight">кейсы</span></h2>
      <p class="page-subtitle">
        Выбирай кейс и испытай удачу. Награды попадут в твой инвентарь.
      </p>

      <div class="cases-grid">
        ${CASES.map((item) => `
          <article class="case-card">
            <div class="case-art">
              <img
                class="case-image"
                src="${item.image}"
                alt="${item.name}"
                loading="eager"
              >
              <span class="case-emoji" style="display:none">${item.emoji}</span>
            </div>

            <h3 class="case-name">${item.name}</h3>
            <div class="case-description">${item.description}</div>
            <div class="case-price">${formatNumber(item.price)} ⭐</div>

            <button
              type="button"
              class="case-open-button"
              data-open-case="${item.price}"
            >Открыть</button>
          </article>
        `).join("")}
      </div>
    `;

    target.querySelectorAll(".case-image").forEach((img) => {
      img.addEventListener("error", () => {
        img.style.display = "none";
        if (img.nextElementSibling) {
          img.nextElementSibling.style.display = "block";
        }
      }, { once: true });
    });
  }

  function renderTopup() {
    const target = $("#ludoman-topup");
    if (!target) return;

    const amounts = [50, 100, 250, 500];

    target.innerHTML = `
      <h2 class="page-heading">Пополнение <span class="highlight">баланса</span></h2>
      <p class="page-subtitle">
        Пополняй внутренний баланс через безопасную оплату Telegram Stars.
      </p>

      <div class="panel">
        <h3 class="panel-title">Выбери сумму</h3>
        <p class="panel-description">
          Оплата проходит через Telegram. После подтверждения платежа сервер
          начислит средства на твой баланс.
        </p>

        <div class="topup-options">
          ${amounts.map((amount) => `
            <button
              type="button"
              class="topup-option ${amount === selectedTopup ? "selected" : ""}"
              data-topup-amount="${amount}"
            >
              <strong>${formatNumber(amount)} ⭐</strong>
              <span>Пополнить</span>
            </button>
          `).join("")}
        </div>

        <label class="form-label" for="custom-topup">
          Или введи другую сумму Stars
        </label>

        <input
          class="text-input"
          id="custom-topup"
          type="number"
          inputmode="numeric"
          min="50"
          max="10000"
          step="1"
          placeholder="От 50 до 10000"
        >

        <button
          type="button"
          class="primary-button topup-submit"
          id="topup-submit"
        >
          Пополнить на ${formatNumber(selectedTopup)} ⭐
        </button>

        <p class="page-subtitle" style="margin:12px 0 0">
          Минимальная сумма пополнения — 50 Stars. Цены кейсов могут быть ниже.
        </p>
      </div>
    `;

    target.querySelectorAll("[data-topup-amount]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedTopup = Number(button.dataset.topupAmount);

        const customInput = $("#custom-topup");
        if (customInput) customInput.value = "";

        target.querySelectorAll("[data-topup-amount]").forEach((option) => {
          option.classList.toggle(
            "selected",
            Number(option.dataset.topupAmount) === selectedTopup
          );
        });

        updateTopupButton();
      });
    });

    $("#custom-topup")?.addEventListener("input", (event) => {
      const value = Number(event.target.value);

      if (Number.isInteger(value) && value > 0) {
        selectedTopup = value;
        target.querySelectorAll("[data-topup-amount]").forEach((option) => {
          option.classList.remove("selected");
        });
        updateTopupButton();
      }
    });

    $("#topup-submit")?.addEventListener("click", createTopup);
  }

  function updateTopupButton() {
    const button = $("#topup-submit");
    if (button) {
      button.textContent = `Пополнить на ${formatNumber(selectedTopup)} ⭐`;
    }
  }

  async function createTopup() {
    if (busy || !requireTelegram()) return;

    const customValue = $("#custom-topup")?.value.trim();
    const amount = customValue ? Number(customValue) : selectedTopup;

    if (!Number.isInteger(amount) || amount < 50 || amount > 10000) {
      notify("Введи целую сумму от 50 до 10000 Stars.", "error");
      return;
    }

    if (!tg?.openInvoice) {
      notify("Не удалось открыть оплату. Запусти приложение внутри Telegram.", "error");
      return;
    }

    busy = true;
    const button = $("#topup-submit");

    if (button) {
      button.disabled = true;
      button.textContent = "Создаём платёж...";
    }

    try {
      const result = await api("/api/star/topup", {
        method: "POST",
        body: JSON.stringify({ amount })
      });

      if (!result.invoice_url) {
        throw new Error("Сервер не вернул ссылку на оплату.");
      }

      tg.openInvoice(result.invoice_url, async (status) => {
        if (status === "paid") {
          notify("Платёж подтверждён. Обновляем баланс...", "success");
          await refreshData();
        } else if (status === "cancelled") {
          notify("Оплата отменена.");
        } else if (status === "failed") {
          notify("Платёж не прошёл. Попробуй ещё раз.", "error");
        }
      });
    } catch (error) {
      notify(error.message || "Не удалось создать платёж.", "error");
    } finally {
      busy = false;
      if (button) {
        button.disabled = false;
        updateTopupButton();
      }
    }
  }

  function showReward(reward, price) {
    const target = $("#case-animation");
    if (!target) return;

    if (!reward || typeof reward !== "object") {
      target.innerHTML = `
        <div class="reward-card">
          <h3 class="reward-title">Кейс открыт!</h3>
          <p class="page-subtitle">
            Проверь инвентарь — там должна появиться твоя награда.
          </p>
        </div>
      `;
      return;
    }

    const name = reward.name || reward.title || reward.item_name || "Новая награда";
    const emoji = reward.emoji || reward.icon || "🎁";
    const value = reward.sell_price ?? reward.value ?? reward.price;

    target.innerHTML = `
      <div class="reward-card">
        <div class="muted">Кейс за ${formatNumber(price)} ⭐</div>
        <div class="reward-icon">${escapeHTML(emoji)}</div>
        <h3 class="reward-title">${escapeHTML(name)}</h3>

        ${value !== undefined ? `
          <div class="reward-value">
            Цена продажи: ${formatNumber(value)}
          </div>
        ` : ""}

        <p class="page-subtitle" style="margin:12px 0 0">
          Награда получена. Она должна появиться в инвентаре.
        </p>

        <button
          type="button"
          class="secondary-button"
          id="reward-to-inventory"
        >Перейти в инвентарь</button>
      </div>
    `;

    $("#reward-to-inventory")?.addEventListener("click", () => {
      showTab("inventory");
    });
  }

  async function openCase(price) {
    if (busy || !requireTelegram()) return;

    const item = CASES.find((entry) => entry.price === price);
    if (!item) {
      notify("Неизвестный кейс.", "error");
      return;
    }

    if (currentBalance < price) {
      notify("Недостаточно средств. Перейди во вкладку «Пополнение».", "error");
      return;
    }

    busy = true;

    document.querySelectorAll("[data-open-case]").forEach((button) => {
      button.disabled = true;
      if (Number(button.dataset.openCase) === price) {
        button.textContent = "Открываем...";
      }
    });

    tg?.HapticFeedback?.impactOccurred("medium");

    try {
      const result = await api("/api/open", {
        method: "POST",
        body: JSON.stringify({ price })
      });

      const reward = result.reward || result.item || result.drop || null;

      if (typeof result.star_balance === "number") {
        currentBalance = result.star_balance;
        updateBalance(currentBalance);
      } else if (typeof result.balance === "number") {
        currentBalance = result.balance;
        updateBalance(currentBalance);
      }

      showReward(reward, price);
      await refreshData();
      notify("Кейс открыт!", "success");
    } catch (error) {
      notify(error.message || "Не удалось открыть кейс.", "error");
    } finally {
      busy = false;
      renderCases();
    }
  }

  function updateBalance(value) {
    currentBalance = Number(value) || 0;
    const target = $("#balance");
    if (target) {
      target.textContent = `${formatNumber(currentBalance)} ⭐`;
    }
  }

  function renderInventory(items) {
    const target = $("#inventory");
    if (!target) return;

    const inventory = Array.isArray(items) ? items : [];

    if (inventory.length === 0) {
      target.innerHTML = `
        <h2 class="page-heading">Мой <span class="highlight">инвентарь</span></h2>
        <p class="page-subtitle">
          Все полученные предметы будут храниться здесь.
        </p>

        <div class="empty-state">
          <span class="empty-icon">🎒</span>
          Инвентарь пока пуст.
          <br>Открой кейс, чтобы получить первую награду.
          <br><br>
          <button
            type="button"
            class="primary-button"
            id="inventory-to-cases"
          >Смотреть кейсы</button>
        </div>
      `;

      $("#inventory-to-cases")?.addEventListener("click", () => showTab("cases"));
      return;
    }

    target.innerHTML = `
      <h2 class="page-heading">Мой <span class="highlight">инвентарь</span></h2>
      <p class="page-subtitle">Твои предметы и доступная стоимость продажи.</p>

      <div class="inventory-summary">
        <span>Предметов в инвентаре</span>
        <strong>${formatNumber(inventory.length)}</strong>
      </div>

      <div class="inventory-list">
        ${inventory.map((item) => {
          const id = item.id ?? item.item_id;
          const name = item.name || item.title || item.item_name || "Предмет";
          const emoji = item.emoji || item.icon || "🎁";
          const sellPrice = Number(item.sell_price ?? item.value ?? 0);
          const canSell = id !== undefined && id !== null && sellPrice > 0;

          return `
            <article class="inventory-item">
              <div class="item-icon">${escapeHTML(emoji)}</div>

              <div class="item-info">
                <h3 class="item-name">${escapeHTML(name)}</h3>
                <div class="item-price">
                  ${canSell ? `Продажа: ${formatNumber(sellPrice)}` : "Предмет получен"}
                </div>
              </div>

              ${canSell ? `
                <button
                  type="button"
                  class="sell-button"
                  data-sell-item="${escapeHTML(id)}"
                >Продать</button>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    `;

    target.querySelectorAll("[data-sell-item]").forEach((button) => {
      button.addEventListener("click", () => {
        sellItem(button.dataset.sellItem, button);
      });
    });
  }

  async function sellItem(itemId, button) {
    if (busy || !requireTelegram()) return;

    busy = true;
    button.disabled = true;
    button.textContent = "...";

    try {
      await api("/api/inventory/sell", {
        method: "POST",
        body: JSON.stringify({ item_id: itemId })
      });

      notify("Предмет продан!", "success");
      await refreshData();
    } catch (error) {
      notify(error.message || "Не удалось продать предмет.", "error");
      button.disabled = false;
      button.textContent = "Продать";
    } finally {
      busy = false;
    }
  }

  function showTab(name) {
    const validTabs = ["cases", "inventory", "topup"];
    if (!validTabs.includes(name)) return;

    document.querySelectorAll(".tab-content").forEach((section) => {
      section.classList.add("hidden");
    });

    const activeSection = $(`#${name}-tab`);
    if (activeSection) activeSection.classList.remove("hidden");

    document.querySelectorAll(".bottom-menu [data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === name);
    });

    tg?.HapticFeedback?.selectionChanged();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshData() {
    if (!tg?.initData) {
      updateBalance(0);
      renderInventory([]);
      return;
    }

    try {
      const data = await api("/api/me");
      const balance = data.star_balance ?? data.balance ?? 0;
      updateBalance(balance);
      renderInventory(data.inventory || []);
    } catch (error) {
      notify(error.message || "Не удалось загрузить данные аккаунта.", "error");
    }
  }

  document.querySelectorAll(".bottom-menu [data-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
  });

  $("#ludoman-cases")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-case]");
    if (!button) return;
    openCase(Number(button.dataset.openCase));
  });

  renderCases();
  renderTopup();
  renderInventory([]);
  showTab("cases");
  refreshData();
});
