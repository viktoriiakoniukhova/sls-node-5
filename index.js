const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const NodeCache = require("node-cache");

// API urls
const urlMono = `https://api.monobank.ua/bank/currency`;
const urlPrivat = `https://api.privatbank.ua/p24api/pubinfo?exchange&coursid=5`;

// Codes ISO 4217
const cUAH = 980;
const cUSD = 840;
const cEUR = 978;

//Node cache setup
const currencyCache = new NodeCache();

//BOT setup

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

//keyboards
const keyboardMenu = {
  reply_markup: {
    keyboard: [["Курс валют"]],
    resize_keyboard: true,
  },
};

const keyboardSubmenu = {
  reply_markup: {
    keyboard: [["USD", "EUR"], ["Назад"]],
    resize_keyboard: true,
  },
};

// Bot event handlers
bot.on("polling_error", (error) => {
  console.log("Помилка: ", error.message);
});

bot.onText(/(\/start)|Назад/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "Натисніть на кнопку для отримання курсу:",
    keyboardMenu
  );
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const response = msg.text;

  const { mUSD, mEUR, pUSD, pEUR } = currencyCache.mget([
    `mUSD`,
    `mEUR`,
    `pUSD`,
    `pEUR`,
  ]);

  if (!mUSD && !pUSD) fetchRates();

  switch (response) {
    case "Курс валют":
      bot.sendMessage(chatId, "Оберіть валюту: ", keyboardSubmenu);
      break;
    case "USD":
      bot.sendMessage(chatId, formOutput("USD", mUSD, pUSD), keyboardMenu);
      break;
    case "EUR":
      bot.sendMessage(chatId, formOutput("EUR", mEUR, pEUR), keyboardMenu);
      break;
    default:
      break;
  }
});

async function fetchRates() {
  const [monoData, privatData] = await Promise.all([
    axios.get(urlMono),
    axios.get(urlPrivat),
  ]);

  transformAndCacheMonoData(monoData);
  transformAndCachePrivatData(privatData);
}

function transformAndCacheMonoData({ data }) {
  const rateUSD = data.filter(
    ({ currencyCodeA, currencyCodeB }) =>
      currencyCodeA === cUSD && currencyCodeB === cUAH
  );

  const rateEUR = data.filter(
    ({ currencyCodeA, currencyCodeB }) =>
      currencyCodeA === cEUR && currencyCodeB === cUAH
  );

  const usd = { buy: rateUSD[0].rateBuy, sell: rateUSD[0].rateSell };
  const eur = { buy: rateEUR[0].rateBuy, sell: rateEUR[0].rateSell };

  currencyCache.mset([
    { key: `mUSD`, val: usd, ttl: 1000 * 60 * 5 },
    { key: `mEUR`, val: eur, ttl: 1000 * 60 * 5 },
  ]);
}

function transformAndCachePrivatData({ data }) {
  const rateUSD = data.filter(
    ({ ccy, base_ccy }) => ccy === "USD" && base_ccy === "UAH"
  );
  const rateEUR = data.filter(
    ({ ccy, base_ccy }) => ccy === "EUR" && base_ccy === "UAH"
  );

  const usd = { buy: rateUSD[0].buy, sell: rateUSD[0].sale };
  const eur = { buy: rateEUR[0].buy, sell: rateEUR[0].sale };

  currencyCache.mset([
    { key: `pUSD`, val: usd, ttl: 1000 * 60 * 5 },
    { key: `pEUR`, val: eur, ttl: 1000 * 60 * 5 },
  ]);
}

function formOutput(curr, m, p) {
  return `Monobank:\n\nКурс: ${curr}/UAH\n\nПродаж: ${m.sell}\nКупівля:${m.buy}\n\nPrivatbank:\n\nКурс: ${curr}/UAH\n\nПродаж: ${p.sell}\nКупівля:${p.buy}`;
}
