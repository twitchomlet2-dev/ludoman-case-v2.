
document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  // Баланс и состояние прокрутки
  let balance = 1000;
  let opening = false;
  let spinTimer = null;

  try {
    const savedBalance = localStorage.getItem("ludoman_balance");
    if (savedBalance !== null && Number.isFinite(Number(savedBalance))) {
      balance = Math.max(0, Number(savedBalance));
    }
  } catch (error) {
    console.log("Ошибка загрузки баланса", error);
  }

  // Инвентарь
  let inventory = [];

  try {
    const saved = JSON.parse(
      localStorage.getItem("ludoman_inventory") || "[]"
    );

    if (Array.isArray(saved)) {
      inventory = saved.filter(item =>
        item &&
        typeof item.name === "string" &&
        typeof item.icon === "string" &&
        typeof item.rarity === "string" &&
        typeof item.desc === "string"
      );
    }
  } catch (error) {
    console.log("Ошибка загрузки инвентаря", error);
  }

  // Статистика открытий
  let stats = {
    opens: 0,
    spent: 0,
    wins: 0,
    history: []
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem("ludoman_stats") || "{}"
    );

    stats.opens = Math.max(0, Number(saved.opens) || 0);
    stats.spent = Math.max(0, Number(saved.spent) || 0);
    stats.wins = Math.max(0, Number(saved.wins) || 0);

    if (Array.isArray(saved.history)) {
      stats.history = saved.history
        .filter(item =>
          item &&
          typeof item.name === "string" &&
          typeof item.icon === "string"
        )
        .slice(-10);
    }
  } catch (error) {
    console.log("Ошибка загрузки статистики", error);
  }

  function saveStats() {
    try {
      localStorage.setItem("ludoman_stats", JSON.stringify(stats));
    } catch (error) {
      console.log("Ошибка сохранения статистики", error);
    }
  }

  // Данные игрока Telegram
  const telegramUser = tg?.initDataUnsafe?.user;
  const playerName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(" ")
    : "Игрок LUDOMAN";

  const playerId = telegramUser?.id
    ? String(telegramUser.id)
    : "Недоступен вне Telegram";

  // Награды
  const rewards = [
    {
      icon: "🪙",
      name: "Монеты",
      desc: "Награда за открытие кейса",
      rarity: "ОБЫЧНЫЙ"
    },
    {
      icon: "💎",
      name: "Кристалл",
      desc: "Редкий коллекционный предмет",
      rarity: "РЕДКИЙ"
    },
    {
      icon: "⚡",
      name: "Энергия",
      desc: "Энергия LUDOMAN",
      rarity: "ОБЫЧНЫЙ"
    },
    {
      icon: "👑",
      name: "Корона",
      desc: "Особая награда",
      rarity: "ЭПИЧЕСКИЙ"
    },
    {
      icon: "🎁",
      name: "Подарок",
      desc: "Сюрприз из кейса",
      rarity: "РЕДКИЙ"
    },
    {
      icon: "🔥",
      name: "Огонь",
      desc: "Огненный предмет",
      rarity: "ЭПИЧЕСКИЙ"
    },
    {
      icon: "🐉",
      name: "Дракон",
      desc: "Легендарная награда",
      rarity: "ЛЕГЕНДАРНЫЙ"
    }
  ];

  // Оформление
  const style = document.createElement("style");

  style.textContent = `
    .lc-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0,0,0,.88);
      backdrop-filter: blur(7px);
    }

    .lc-panel {
      width: 100%;
      max-width: 420px;
      max-height: 88vh;
      overflow-y: auto;
      box-sizing: border-box;
      padding: 22px 16px;
      border: 1px solid #b6ff00;
      border-radius: 20px;
      background: #10120c;
      color: white;
      text-align: center;
      font-family: Arial, sans-serif;
    }

    .lc-title {
      margin: 0 0 8px;
      color: #c5ff36;
      font-size: 23px;
      font-weight: 900;
    }

    .lc-subtitle {
      margin-bottom: 20px;
      color: #aaa;
      font-size: 14px;
    }

    .lc-window {
      position: relative;
      width: 100%;
      height: 112px;
      margin: 22px 0;
      overflow: hidden;
      border: 1px solid #393f2c;
      border-radius: 12px;
      background: #191c14;
    }

    .lc-window::before {
      content: "";
      position: absolute;
      z-index: 2;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 3px;
      transform: translateX(-50%);
      background: #c5ff36;
      box-shadow: 0 0 12px #b6ff00;
      pointer-events: none;
    }

    .lc-track {
      position: absolute;
      top: 0;
      left: 0;
      display: flex;
      height: 100%;
      will-change: transform;
    }

    .lc-item {
      flex: 0 0 88px;
      width: 88px;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border-right: 1px solid #303426;
      gap: 7px;
    }

    .lc-item-icon {
      font-size: 34px;
    }

    .lc-item-name {
      max-width: 82px;
      padding: 0 3px;
      overflow: hidden;
      color: #ddd;
      font-size: 10px;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lc-status {
      min-height: 20px;
      color: #c5ff36;
      font-size: 14px;
      font-weight: 900;
    }

    .lc-prize {
      margin: 14px 0;
    }

    .lc-prize-icon {
      font-size: 64px;
    }

    .lc-prize-name {
      margin: 8px 0;
      font-size: 22px;
      font-weight: 900;
    }

    .lc-prize-rarity {
      color: #c5ff36;
      font-size: 13px;
      font-weight: 900;
    }

    .lc-prize-desc {
      margin-top: 8px;
      color: #aaa;
      font-size: 13px;
    }

    .lc-hidden {
      display: none !important;
    }

    .lc-button {
      width: 100%;
      min-height: 46px;
      padding: 12px;
      border: 1px solid #b6ff00;
      border-radius: 12px;
      background: #c5ff36;
      color: #10120c;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
    }

    .lc-inventory-button,
    .lc-profile-button {
      position: fixed;
      bottom: 18px;
      z-index: 9998;
      padding: 12px 13px;
      border: 1px solid #b6ff00;
      border-radius: 14px;
      background: #10120c;
      color: #c5ff36;
      font-weight: 900;
      font-size: 13px;
      cursor: pointer;
    }

    .lc-inventory-button {
      right: 12px;
    }

    .lc-profile-button {
      left: 12px;
    }

    .lc-inventory-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .lc-inventory-card,
    .lc-stat-card {
      min-width: 0;
      padding: 14px 8px;
      overflow-wrap: anywhere;
      border: 1px solid #373b2e;
      border-radius: 14px;
      background: #191c14;
    }

    .lc-stat-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 16px 0;
    }

    .lc-stat-number {
      margin-top: 8px;
      color: #c5ff36;
      font-size: 25px;
      font-weight: 900;
    }

    .lc-stat-label {
      color: #aaa;
      font-size: 12px;
    }

    .lc-player-name {
      margin: 12px 0 6px;
      font-size: 20px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .lc-player-id {
      color: #aaa;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .lc-history-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      text-align: left;
      border-bottom: 1px solid #303426;
    }

    .lc-history-icon {
      font-size: 28px;
    }

    .lc-history-name {
      font-weight: 800;
    }

    .lc-history-rarity {
      margin-top: 4px;
      color: #c5ff36;
      font-size: 11px;
    }
  `;

  document.head.appendChild(style);

  // Обновление баланса
  function updateBalance() {
    const element = document.getElementById("balance");

    if (element) {
      element.textContent = balance.toLocaleString("ru-RU");
    }

    try {
      localStorage.setItem("ludoman_balance", String(balance));
    } catch (error) {
      console.log("Ошибка сохранения баланса", error);
    }
  }

  // Кнопка инвентаря
  const inventoryButton = document.createElement("button");
  inventoryButton.className = "lc-inventory-button";
  document.body.appendChild(inventoryButton);

  function saveInventory() {
    try {
      localStorage.setItem("ludoman_inventory", JSON.stringify(inventory));
    } catch (error) {
      console.log("Ошибка сохранения инвентаря", error);
    }

    inventoryButton.textContent = `🎒 Инвентарь (${inventory.length})`;
  }

  // Создание окна
  function createOverlay(id) {
    const overlay = document.createElement("div");
    overlay.className = "lc-overlay";
    overlay.id = id;

    const panel = document.createElement("div");
    panel.className = "lc-panel";

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });

    return { overlay, panel };
  }

  // Кнопка закрытия окна
  function addCloseButton(panel, overlay) {
    const close = document.createElement("button");
    close.className = "lc-button";
    close.textContent = "Закрыть";
    close.style.marginTop = "16px";
    close.addEventListener("click", () => overlay.remove());
    panel.appendChild(close);
  }

  // Инвентарь
  function showInventory() {
    if (document.getElementById("lc-inventory-overlay")) return;

    const { overlay, panel } = createOverlay("lc-inventory-overlay");

    const title = document.createElement("h2");
    title.className = "lc-title";
    title.textContent = "МОЙ ИНВЕНТАРЬ";

    const count = document.createElement("div");
    count.className = "lc-subtitle";
    count.textContent = `Предметов: ${inventory.length}`;

    panel.append(title, count);

    if (inventory.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Пока пусто. Открой кейс, чтобы получить предмет!";
      empty.style.color = "#aaa";
      panel.appendChild(empty);
    } else {
      const grid = document.createElement("div");
      grid.className = "lc-inventory-grid";

      inventory.slice().reverse().forEach(item => {
        const card = document.createElement("div");
        card.className = "lc-inventory-card";

        const icon = document.createElement("div");
        icon.textContent = item.icon;
        icon.style.fontSize = "34px";

        const name = document.createElement("div");
        name.textContent = item.name;
        name.style.cssText = "font-weight:900;margin:8px 0;";

        const rarity = document.createElement("div");
        rarity.textContent = item.rarity;
        rarity.style.cssText = "font-size:12px;color:#c5ff36;";

        card.append(icon, name, rarity);
        grid.appendChild(card);
      });

      panel.appendChild(grid);
    }

    addCloseButton(panel, overlay);
  }

  inventoryButton.addEventListener("click", showInventory);

  // Кнопка профиля
  const profileButton = document.createElement("button");
  profileButton.className = "lc-profile-button";
  profileButton.textContent = "👤 Профиль";
  document.body.appendChild(profileButton);

  // Окно профиля и статистики
  function showProfile() {
    if (document.getElementById("lc-profile-overlay")) return;

    const { overlay, panel } = createOverlay("lc-profile-overlay");

    const title = document.createElement("h2");
    title.className = "lc-title";
    title.textContent = "ПРОФИЛЬ ИГРОКА";

    const avatar = document.createElement("div");
    avatar.textContent = "👤";
    avatar.style.fontSize = "54px";

    const name = document.createElement("div");
    name.className = "lc-player-name";
    name.textContent = playerName;

    const id = document.createElement("div");
    id.className = "lc-player-id";
    id.textContent = `Telegram ID: ${playerId}`;

    panel.append(title, avatar, name, id);

    const statsGrid = document.createElement("div");
    statsGrid.className = "lc-stat-grid";

    const statItems = [
      ["🎁", stats.opens, "Открытий кейсов"],
      ["🪙", stats.spent.toLocaleString("ru-RU"), "Монет потрачено"],
      ["🏆", stats.wins, "Выиграно предметов"],
      ["🎒", inventory.length, "Предметов в инвентаре"]
    ];

    statItems.forEach(([icon, value, label]) => {
      const card = document.createElement("div");
      card.className = "lc-stat-card";

      const emoji = document.createElement("div");
      emoji.textContent = icon;
      emoji.style.fontSize = "25px";

      const number = document.createElement("div");
      number.className = "lc-stat-number";
      number.textContent = String(value);

      const caption = document.createElement("div");
      caption.className = "lc-stat-label";
      caption.textContent = label;

      card.append(emoji, number, caption);
      statsGrid.appendChild(card);
    });

    panel.appendChild(statsGrid);

    const historyTitle = document.createElement("h3");
    historyTitle.textContent = "ПОСЛЕДНИЕ ВЫИГРЫШИ";
    historyTitle.style.cssText =
      "margin:20px 0 10px;color:#c5ff36;font-size:15px;";

    panel.appendChild(historyTitle);

    if (stats.history.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Здесь появятся твои выигрыши после открытия кейсов.";
      empty.style.cssText = "color:#aaa;font-size:13px;";
      panel.appendChild(empty);
    } else {
      stats.history.slice().reverse().forEach(item => {
        const row = document.createElement("div");
        row.className = "lc-history-row";

        const icon = document.createElement("div");
        icon.className = "lc-history-icon";
        icon.textContent = item.icon;

        const details = document.createElement("div");

        const itemName = document.createElement("div");
        itemName.className = "lc-history-name";
        itemName.textContent = item.name;

        const rarity = document.createElement("div");
        rarity.className = "lc-history-rarity";
        rarity.textContent = item.rarity || "НАГРАДА";

        details.append(itemName, rarity);
        row.append(icon, details);
        panel.appendChild(row);
      });
    }

    addCloseButton(panel, overlay);
  }

  profileButton.addEventListener("click", showProfile);

  saveInventory();
  updateBalance();

  // Предмет на ленте
  function createTrackItem(reward) {
    const item = document.createElement("div");
    item.className = "lc-item";

    const icon = document.createElement("div");
    icon.className = "lc-item-icon";
    icon.textContent = reward.icon;

    const name = document.createElement("div");
    name.className = "lc-item-name";
    name.textContent = reward.name;

    item.append(icon, name);
    return item;
  }

  // Открытие кейса
  function openCase(button) {
    if (opening) return;

    const price = Number(button.dataset.price);

    if (!Number.isFinite(price) || price < 0) {
      alert("У этого кейса указана неправильная цена.");
      return;
    }

    if (balance < price) {
      alert("Недостаточно монет для открытия кейса!");
      return;
    }

    opening = true;
    balance -= price;

    stats.opens += 1;
    stats.spent += price;
    saveStats();
    updateBalance();

    button.disabled = true;
    const oldButtonText = button.textContent;
    button.textContent = "Открываем...";

    const { overlay, panel } = createOverlay("lc-case-overlay");

    const title = document.createElement("h2");
    title.className = "lc-title";
    title.textContent = "LUDOMAN CASE";

    const subtitle = document.createElement("div");
    subtitle.className = "lc-subtitle";
    subtitle.textContent = "Испытай удачу";

    const viewport = document.createElement("div");
    viewport.className = "lc-window";

    const track = document.createElement("div");
    track.className = "lc-track";
    viewport.appendChild(track);

    const status = document.createElement("div");
    status.className = "lc-status";
    status.textContent = "Прокручиваем...";

    const prize = document.createElement("div");
    prize.className = "lc-prize lc-hidden";

    const prizeIcon = document.createElement("div");
    prizeIcon.className = "lc-prize-icon";

    const prizeName = document.createElement("div");
    prizeName.className = "lc-prize-name";

    const prizeRarity = document.createElement("div");
    prizeRarity.className = "lc-prize-rarity";

    const prizeDesc = document.createElement("div");
    prizeDesc.className = "lc-prize-desc";

    prize.append(prizeIcon, prizeName, prizeRarity, prizeDesc);

    const closeButton = document.createElement("button");
    closeButton.className = "lc-button lc-hidden";
    closeButton.textContent = "Забрать и закрыть";

    panel.append(
      title,
      subtitle,
      viewport,
      status,
      prize,
      closeButton
    );

    let finished = false;
    let animation = null;

    const winningIndex = 45;
    const winningReward = rewards[
      Math.floor(Math.random() * rewards.length)
    ];
    const totalItems = 55;

    for (let i = 0; i < totalItems; i++) {
      const reward = i === winningIndex
        ? winningReward
        : rewards[Math.floor(Math.random() * rewards.length)];

      track.appendChild(createTrackItem(reward));
    }

    function finishSpin() {
      if (finished) return;
      finished = true;

      if (spinTimer) {
        clearTimeout(spinTimer);
        spinTimer = null;
      }

      if (animation) {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
        animation = null;
      }

      const winningItem = track.children[winningIndex];

      if (winningItem) {
        const center =
          winningItem.offsetLeft + winningItem.offsetWidth / 2;
        const targetX = viewport.clientWidth / 2 - center;
        track.style.transform = `translateX(${targetX}px)`;
      }

      status.textContent = "ВЫИГРЫШ!";
      prizeIcon.textContent = winningReward.icon;
      prizeName.textContent = winningReward.name;
      prizeRarity.textContent = winningReward.rarity;
      prizeDesc.textContent = winningReward.desc;

      prize.classList.remove("lc-hidden");
      closeButton.classList.remove("lc-hidden");

      const wonItem = {
        icon: winningReward.icon,
        name: winningReward.name,
        desc: winningReward.desc,
        rarity: winningReward.rarity,
        date: Date.now()
      };

      inventory.push(wonItem);
      stats.wins += 1;
      stats.history.push(wonItem);
      stats.history = stats.history.slice(-10);

      saveInventory();
      saveStats();

      if (tg?.HapticFeedback) {
        try {
          tg.HapticFeedback.notificationOccurred("success");
        } catch (error) {
          console.log("Вибрация недоступна", error);
        }
      }
    }

    function closeCase() {
      if (!finished) return;

      overlay.remove();
      opening = false;
      button.disabled = false;
      button.textContent = oldButtonText;
    }

    closeButton.addEventListener("click", closeCase);

    overlay.addEventListener("click", event => {
      if (event.target === overlay && finished) {
        closeCase();
      }
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished || !overlay.isConnected) return;

        const winningItem = track.children[winningIndex];

        if (!winningItem || viewport.clientWidth === 0) {
          finishSpin();
          return;
        }

        const center =
          winningItem.offsetLeft + winningItem.offsetWidth / 2;
        const targetX = viewport.clientWidth / 2 - center;

        try {
          animation = track.animate(
            [
              { transform: "translateX(0px)" },
              { transform: `translateX(${targetX}px)` }
            ],
            {
              duration: 6500,
              easing: "cubic-bezier(.08,.65,.12,1)",
              fill: "forwards"
                }
          );

          animation.onfinish = finishSpin;
          animation.oncancel = () => {
            if (!finished) finishSpin();
          };
        } catch (error) {
          console.log("Ошибка анимации", error);
          finishSpin();
        }

        spinTimer = setTimeout(finishSpin, 7500);
      });
    });
  }

  // Кнопки открытия кейсов
  document
    .querySelectorAll(".open-btn[data-price]")
    .forEach(button => {
      button.addEventListener("click", () => openCase(button));
    });
});
