
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

let balance = 1000;

const balanceElement = document.getElementById("balance");
const resultElement = document.getElementById("result");
const rewardIcon = document.getElementById("reward-icon");
const rewardName = document.getElementById("reward-name");
const rewardDesc = document.getElementById("reward-desc");
const closeResult = document.getElementById("close-result");

const rewards = [
  { icon: "🪙", name: "Монеты", desc: "Ты нашёл немного виртуальных монет!" },
  { icon: "💎", name: "Кристалл", desc: "Редкая демо-награда!" },
  { icon: "⚡", name: "Энергия", desc: "Энергия удачи на твоей стороне!" },
  { icon: "👑", name: "Корона", desc: "Королевская демо-награда!" },
  { icon: "🎁", name: "Сюрприз", desc: "Что-то интересное из кейса!" }
];

function updateBalance() {
  balanceElement.textContent = balance;
}

document.querySelectorAll(".open-btn[data-price]").forEach((button) => {
  button.addEventListener("click", () => {
    const price = Number(button.dataset.price);
    const caseName = button.dataset.case;

    if (balance < price) {
      alert("Не хватает виртуальных монет!");
      return;
    }

    balance -= price;
    updateBalance();

    button.disabled = true;
    button.textContent = "Открываем...";

    resultElement.classList.add("hidden");

    setTimeout(() => {
      const reward = rewards[Math.floor(Math.random() * rewards.length)];

      rewardIcon.textContent = reward.icon;
      rewardName.textContent = reward.name;
      rewardDesc.textContent = `Кейс ${caseName} открыт! ${reward.desc}`;

      resultElement.classList.remove("hidden");
      button.disabled = false;
      button.textContent = `Открыть · ${price} 🪙`;

      resultElement.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
      }
    }, 900);
  });
});

closeResult.addEventListener("click", () => {
  resultElement.classList.add("hidden");
});

updateBalance();
