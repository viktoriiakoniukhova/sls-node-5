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

  switch (response) {
    case "Курс валют":
      bot.sendMessage(chatId, "Оберіть валюту: ", keyboardSubmenu);
      break;
    case "USD":
      fetchRates(cUSD, chatId);
      break;
    case "EUR":
      fetchRates(cEUR, chatId);
      break;
    default:
      break;
  }
});

async function fetchRates(codeCurr, chatId) {
  if (
    !currencyCache.get(`mono${codeCurr}`) &&
    !currencyCache.get(`privat${codeCurr}`)
  ) {
    const [monoData, privatData] = await Promise.all([
      axios.get(urlMono),
      axios.get(urlPrivat),
    ]);

    transformAndCacheMonoData(monoData);
    transformAndCachePrivatData(privatData);
  }

  const mono = currencyCache.get(`mono${codeCurr}`);
  const privat = currencyCache.get(`privat${codeCurr}`);

  bot.sendMessage(chatId, mono.concat(privat), keyboardMenu);
}

function transformAndCacheMonoData({ data }) {
  const rateUSD = data.filter(
    ({ currencyCodeA, currencyCodeB }) =>
      currencyCodeA === cUSD && currencyCodeB === cUAH
  );

  const { rateBuy: rbu, rateSell: rsu } = rateUSD[0];

  const rateEUR = data.filter(
    ({ currencyCodeA, currencyCodeB }) =>
      currencyCodeA === cEUR && currencyCodeB === cUAH
  );
  const { rateBuy: rbe, rateSell: rse } = rateEUR[0];

  const usd = `Monobank:\n\nКурс: USD/UAH\n\nПродаж: ${rsu}\nКупівля:${rbu}\n`;
  const eur = `Monobank:\n\nКурс: EUR/UAH\n\nПродаж: ${rse}\nКупівля:${rbe}\n`;

  currencyCache.set(`mono${cUSD}`, usd, 1000 * 60 * 5);
  currencyCache.set(`mono${cEUR}`, eur, 1000 * 60 * 5);
}

function transformAndCachePrivatData({ data }) {
  const rateUSD = data.filter(
    ({ ccy, base_ccy }) => ccy === "USD" && base_ccy === "UAH"
  );
  const rateEUR = data.filter(
    ({ ccy, base_ccy }) => ccy === "EUR" && base_ccy === "UAH"
  );

  const { buy: bu, sale: su } = rateUSD[0];
  const { buy: be, sale: se } = rateEUR[0];

  const usd = `\nPrivatbank:\n\nКурс: USD/UAH\n\nПродаж: ${su}\nКупівля:${bu}`;
  const eur = `\nPrivatbank:\n\nКурс: EUR/UAH\n\nПродаж: ${se}\nКупівля:${be}`;

  currencyCache.set(`privat${cUSD}`, usd, 1000 * 60 * 5);
  currencyCache.set(`privat${cEUR}`, eur, 1000 * 60 * 5);
}
