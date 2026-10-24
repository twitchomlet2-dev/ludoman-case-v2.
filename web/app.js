document.addEventListener("DOMContentLoaded", () => {
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

let balance = 1000;

try {
  const savedBalance = localStorage.getItem("ludoman_balance");

  if (savedBalance !== null && Number.isFinite(Number(savedBalance))) {
    balance = Number(savedBalance);
  }
} catch (error) {
  console.log("Не удалось загрузить баланс:", error);
}
  const rewards = [
    { icon: "🪙", name: "Монеты", desc: "Немного виртуальных монет!", rarity: "Обычный" },
    { icon: "💎", name: "Кристалл", desc: "Редкая демо-награда!", rarity: "Редкий" },
    { icon: "⚡", name: "Энергия", desc: "Энергия удачи на твоей стороне!", rarity: "Редкий" },
    { icon: "👑", name: "Корона", desc: "Королевская демо-награда!", rarity: "Легендарный" },
    { icon: "🎁", name: "Сюрприз", desc: "Интересная находка из кейса!", rarity: "Эпический" },
    { icon: "🔥", name: "Огонь", desc: "Горячая находка!", rarity: "Эпический" },
    { icon: "🐉", name: "Дракон", desc: "Мощная демо-награда!", rarity: "Легендарный" }
  ];

  const style = document.createElement("style");
  style.textContent = `
    .lc-overlay {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      padding: 18px; background: rgba(0,0,0,.88);
      backdrop-filter: blur(8px);
    }
    .lc-panel {
      width: 100%; max-width: 440px; box-sizing: border-box;
      padding: 22px 16px; border: 1px solid #b6ff00;
      border-radius: 22px; background: #10120c; color: white;
      text-align: center; font-family: Arial, sans-serif;
      box-shadow: 0 0 35px rgba(182,255,0,.15);
    }
    .lc-title {
      margin: 0 0 8px; font-size: 23px; font-weight: 900;
      color: #c5ff36;
    }
    .lc-subtitle { color: #aaa; font-size: 13px; margin-bottom: 22px; }
    .lc-window {
      position: relative; overflow: hidden; width: 100%;
      height: 120px; border-radius: 14px;
      background: #080907; border: 1px solid #333;
    }
    .lc-window:before {
      content: ""; position: absolute; z-index: 3;
      top: 0; bottom: 0; left: 50%; width: 3px;
      transform: translateX(-50%);
      background: #c5ff36; box-shadow: 0 0 15px #b6ff00;
    }
    .lc-track {
      height: 100%; display: flex; align-items: center;
      gap: 10px; width: max-content; transform: translateX(0);
    }
    .lc-item {
      flex: 0 0 100px; width: 100px; height: 94px;
      box-sizing: border-box; border-radius: 12px;
      background: #191c14; border: 1px solid #373b2e;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 7px;
    }
    .lc-item-icon { font-size: 35px; line-height: 1; }
    .lc-item-name {
      max-width: 90px; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; font-size: 11px; color: #ddd;
    }
    .lc-status {
      min-height: 22px; margin: 18px 0 8px;
      color: #c5ff36; font-size: 14px; font-weight: bold;
    }
    .lc-prize { padding: 12px 0 4px; }
    .lc-prize-icon { font-size: 58px; }
    .lc-prize-name { font-size: 22px; font-weight: 900; margin: 8px 0; }
    .lc-prize-rarity { color: #c5ff36; font-size: 12px; text-transform: uppercase; }
    .lc-prize-desc { color: #aaa; font-size: 13px; margin: 8px 0 16px; }
    .lc-button {
      width: 100%; border: 0; border-radius: 12px;
      padding: 14px; background: #c5ff36; color: #10120c;
      font-size: 15px; font-weight: 900; cursor: pointer;
    }
    .lc-button:disabled { opacity: .5; }
    .lc-hidden { display: none !important; }
  `;
  document.head.appendChild(style);

  function updateBalance() {
  if (balanceElement) {
    balanceElement.textContent = balance;
  }

  try {
    localStorage.setItem("ludoman_balance", String(balance));
  } catch (error) {
    console.log("Не удалось сохранить баланс:", error);
  }
  }

  localStorage.setItem("ludoman_balance", String(balance));
  }

  function randomReward() {
    return rewards[Math.floor(Math.random() * rewards.length)];
  }

  function openCase(button) {
    if (opening) return;

    const price = Number(button.dataset.price);
    const caseName = button.dataset.case || "LUDOMAN";

    if (!Number.isFinite(price) || price < 0) {
      alert("Не удалось определить цену кейса.");
      return;
    }

    if (balance < price) {
      alert("Не хватает виртуальных монет!");
      return;
    }

    opening = true;
    balance -= price;
    updateBalance();

    button.disabled = true;

    const overlay = document.createElement("div");
    overlay.className = "lc-overlay";
    overlay.innerHTML = `
      <div class="lc-panel">
        <h2 class="lc-title">LUDOMAN CASE</h2>
        <div class="lc-subtitle"></div>
        <div class="lc-window">
          <div class="lc-track"></div>
        </div>
        <div class="lc-status">Кейс открывается...</div>
        <div class="lc-prize lc-hidden">
          <div class="lc-prize-icon"></div>
          <div class="lc-prize-name"></div>
          <div class="lc-prize-rarity"></div>
          <div class="lc-prize-desc"></div>
        </div>
        <button class="lc-button lc-hidden">Забрать демо-награду</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const subtitle = overlay.querySelector(".lc-subtitle");
    const track = overlay.querySelector(".lc-track");
    const viewport = overlay.querySelector(".lc-window");
    const status = overlay.querySelector(".lc-status");
    const prize = overlay.querySelector(".lc-prize");
    const prizeIcon = overlay.querySelector(".lc-prize-icon");
    const prizeName = overlay.querySelector(".lc-prize-name");
    const prizeRarity = overlay.querySelector(".lc-prize-rarity");
    const prizeDesc = overlay.querySelector(".lc-prize-desc");
    const closeButton = overlay.querySelector(".lc-button");

    subtitle.textContent = `Кейс: ${caseName}`;

    const winningReward = randomReward();
    const winningIndex = 45;
    const totalItems = 55;

    for (let i = 0; i < totalItems; i++) {
      const itemReward = i === winningIndex ? winningReward : randomReward();
      const item = document.createElement("div");
      item.className = "lc-item";

      const icon = document.createElement("div");
      icon.className = "lc-item-icon";
      icon.textContent = itemReward.icon;

      const name = document.createElement("div");
      name.className = "lc-item-name";
      name.textContent = itemReward.name;

      item.append(icon, name);
      track.appendChild(item);
    }

    closeButton.addEventListener("click", () => {
      overlay.remove();
      opening = false;
      button.disabled = false;
      button.textContent = `Открыть · ${price} 🪙`;
    });

    button.textContent = "Открываем...";

    
        track.style.transition = "transform 6s cubic-bezier(.08,.65,.12,1)";
        track.style.transform = `translateX(${offset}px)`;
      });
  requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const itemWidth = 110;
    const winnerCenter = winningIndex * itemWidth + 50;
    const offset = viewport.clientWidth / 2 - winnerCenter;
    });

    track.addEventListener("transitionend", () => {
      status.textContent = "ВЫИГРЫШ!";
      prizeIcon.textContent = winningReward.icon;
      prizeName.textContent = winningReward.name;
      prizeRarity.textContent = winningReward.rarity;
      prizeDesc.textContent = winningReward.desc;

      prize.classList.remove("lc-hidden");
      closeButton.classList.remove("lc-hidden");

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
      }
    }, { once: true });
  }

  document.querySelectorAll(".open-btn[data-price]").forEach((button) => {
    button.addEventListener("click", () => openCase(button));
  });

  updateBalance();
  console.log("LUDOMAN Case: анимация загружена!");
});
