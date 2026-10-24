
document.addEventListener("DOMContentLoaded", () => {
  // Telegram Mini App
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  // Баланс
  let balance = 1000;
  let opening = false;
  let spinTimer = null;

  try {
    const savedBalance = localStorage.getItem("ludoman_balance");
    if (savedBalance !== null && Number.isFinite(Number(savedBalance))) {
      balance = Math.max(0, Number(savedBalance));
    }
  } catch (error) {
    console.log("Не удалось загрузить баланс", error);
  }

  // Инвентарь
  let inventory = [];

  try {
    const savedInventory = JSON.parse(
      localStorage.getItem("ludoman_inventory") || "[]"
    );

    if (Array.isArray(savedInventory)) {
      inventory = savedInventory.filter(
        item =>
          item &&
          typeof item.name === "string" &&
          typeof item.icon === "string" &&
          typeof item.rarity === "string" &&
          typeof item.desc === "string"
      );
    }
  } catch (error) {
    console.log("Не удалось загрузить инвентарь", error);
  }

  // Предметы
  const rewards = [
    { icon: "🪙", name: "Монеты", desc: "Награда за открытие кейса", rarity: "ОБЫЧНЫЙ" },
    { icon: "💎", name: "Кристалл", desc: "Редкий коллекционный предмет", rarity: "РЕДКИЙ" },
    { icon: "⚡", name: "Энергия", desc: "Энергия LUDOMAN", rarity: "ОБЫЧНЫЙ" },
    { icon: "👑", name: "Корона", desc: "Особая награда", rarity: "ЭПИЧЕСКИЙ" },
    { icon: "🎁", name: "Подарок", desc: "Сюрприз из кейса", rarity: "РЕДКИЙ" },
    { icon: "🔥", name: "Огонь", desc: "Огненный предмет", rarity: "ЭПИЧЕСКИЙ" },
    { icon: "🐉", name: "Дракон", desc: "Легендарная награда", rarity: "ЛЕГЕНДАРНЫЙ" }
  ];

  // Стили окна прокрутки и инвентаря
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

    .lc-inventory-button {
      position: fixed;
      right: 14px;
      bottom: 18px;
      z-index: 9998;
      padding: 13px 16px;
      border: 1px solid #b6ff00;
      border-radius: 14px;
      background: #10120c;
      color: #c5ff36;
      font-weight: 900;
      font-size: 14px;
      cursor: pointer;
    }

    .lc-inventory-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .lc-inventory-card {
      min-width: 0;
      padding: 14px 6px;
      overflow-wrap: anywhere;
      border: 1px solid #373b2e;
      border-radius: 14px;
      background: #191c14;
    }
  `;

  document.head.appendChild(style);

  // Баланс на экране
  function updateBalance() {
    const balanceElement = document.getElementById("balance");

    if (balanceElement) {
      balanceElement.textContent = balance.toLocaleString("ru-RU");
    }

    try {
      localStorage.setItem("ludoman_balance", String(balance));
    } catch (error) {
      console.log("Не удалось сохранить баланс", error);
    }
  }

  // Сохранение инвентаря
  const inventoryButton = document.createElement("button");
  inventoryButton.className = "lc-inventory-button";
  inventoryButton.textContent = "🎒 Инвентарь (0)";
  document.body.appendChild(inventoryButton);

  function saveInventory() {
    try {
      localStorage.setItem("ludoman_inventory", JSON.stringify(inventory));
    } catch (error) {
      console.log("Не удалось сохранить инвентарь", error);
    }

    inventoryButton.textContent = `🎒 Инвентарь (${inventory.length})`;
  }

  // Окно инвентаря
  function showInventory() {
    if (document.getElementById("lc-inventory-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lc-inventory-overlay";
    overlay.className = "lc-overlay";

    const panel = document.createElement("div");
    panel.className = "lc-panel";

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
        name.style.cssText = "font-weight:900;margin:8px 0;color:white;";

        const rarity = document.createElement("div");
        rarity.textContent = item.rarity;
        rarity.style.cssText = "font-size:12px;color:#c5ff36;";

        card.append(icon, name, rarity);
        grid.appendChild(card);
      });

      panel.appendChild(grid);
    }

    const close = document.createElement("button");
    close.className = "lc-button";
    close.textContent = "Закрыть";
    close.style.marginTop = "16px";
    close.addEventListener("click", () => overlay.remove());

    panel.appendChild(close);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
  }

  inventoryButton.addEventListener("click", showInventory);
  saveInventory();

  // Создание предмета на ленте
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
    updateBalance();

    button.disabled = true;
    const oldButtonText = button.textContent;
    button.textContent = "Открываем...";

    const overlay = document.createElement("div");
    overlay.className = "lc-overlay";

    const panel = document.createElement("div");
    panel.className = "lc-panel";

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

    panel.append(title, subtitle, viewport, status, prize, closeButton);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    let finished = false;
    let animation = null;

    // Победитель выбирается один раз
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

      // Остановить анимацию в целевой позиции, если она ещё идёт
      if (animation) {
        animation.onfinish = null;
        animation.cancel();
        animation = null;
      }

      const winningItem = track.children[winningIndex];

      if (winningItem) {
        const itemCenter =
          winningItem.offsetLeft + winningItem.offsetWidth / 2;

        const targetX = viewport.clientWidth / 2 - itemCenter;

        // Зафиксировать ленту на победном предмете
        track.style.transform = `translateX(${targetX}px)`;
      }

      status.textContent = "ВЫИГРЫШ!";
      prizeIcon.textContent = winningReward.icon;
      prizeName.textContent = winningReward.name;
      prizeRarity.textContent = winningReward.rarity;
      prizeDesc.textContent = winningReward.desc;
      prize.classList.remove("lc-hidden");
      closeButton.classList.remove("lc-hidden");

      // Сохранить выигрыш в инвентаре
      inventory.push({
        icon: winningReward.icon,
        name: winningReward.name,
        desc: winningReward.desc,
        rarity: winningReward.rarity,
        date: Date.now()
      });

      saveInventory();

      if (tg?.HapticFeedback) {
        try {
          tg.HapticFeedback.notificationOccurred("success");
        } catch (error) {
          console.log("Вибрация недоступна", error);
        }
      }
    }

    closeButton.addEventListener("click", () => {
      if (!finished) return;

      overlay.remove();
      opening = false;
      button.disabled = false;
      button.textContent = oldButtonText;
    });

    overlay.addEventListener("click", event => {
      // Не закрываем окно до завершения прокрутки
      if (event.target === overlay && finished) {
        overlay.remove();
        opening = false;
        button.disabled = false;
        button.textContent = oldButtonText;
      }
    });

    // Начать анимацию после появления окна
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (finished || !overlay.isConnected) return;

        const winningItem = track.children[winningIndex];

        if (!winningItem || viewport.clientWidth === 0) {
          finishSpin();
          return;
        }

        const itemCenter =
          winningItem.offsetLeft + winningItem.offsetWidth / 2;

        const targetX = viewport.clientWidth / 2 - itemCenter;

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
            // Если анимацию отменило устройство или браузер,
            // всё равно завершаем прокрутку и показываем выигрыш.
            if (!finished) finishSpin();
          };
        } catch (error) {
          console.log("Анимация недоступна, завершаем прокрутку", error);
          finishSpin();
        }

        // Страховка: результат покажется даже если браузер
        // не отправит событие окончания анимации.
        spinTimer = setTimeout(finishSpin, 7500);
      });
    });
  }

  // Подключить все кнопки открытия кейсов
  const caseButtons = document.querySelectorAll(".open-btn[data-price]");

  caseButtons.forEach(button => {
    button.addEventListener("click", () => openCase(button));
  });

  updateBalance();
});
