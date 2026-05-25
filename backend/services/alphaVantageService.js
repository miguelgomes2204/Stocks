const axios = require('axios');
const StockPrice = require('../models/StockPrice');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

/**
 * Obter preço atual de uma ação usando Alpha Vantage
 */
async function getStockPrice(ticker) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: ticker,
        apikey: ALPHA_VANTAGE_API_KEY
      },
      timeout: 5000
    });

    const quote = response.data['Global Quote'];

    if (!quote || Object.keys(quote).length === 0) {
      console.warn(`Nenhuma data recebida para ${ticker}`);
      return null;
    }

    const preco = parseFloat(quote['05. price']);
    const precoAnterior = parseFloat(quote['08. previous close']);
    const variacao = ((preco - precoAnterior) / precoAnterior * 100).toFixed(2);

    return {
      ticker: ticker.toUpperCase(),
      preco,
      precoAnterior,
      variacao: parseFloat(variacao),
      volume: parseInt(quote['06. volume'] || 0),
      fonte: 'alpha_vantage'
    };
  } catch (error) {
    console.error(`Erro ao obter preço de ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Obter dados históricos de uma ação (últimos 100 dias)
 */
async function getStockHistory(ticker, interval = 'daily') {
  try {
    const functionType = interval === 'daily' ? 'TIME_SERIES_DAILY' : 'TIME_SERIES_INTRADAY';
    const params = {
      function: functionType,
      symbol: ticker,
      apikey: ALPHA_VANTAGE_API_KEY
    };

    if (interval === 'intraday') {
      params.interval = '5min';
    }

    const response = await axios.get(BASE_URL, {
      params,
      timeout: 5000
    });

    const timeSeriesKey = Object.keys(response.data).find(key => key.includes('Time Series'));
    if (!timeSeriesKey) {
      console.warn(`Nenhum histórico encontrado para ${ticker}`);
      return [];
    }

    const timeSeries = response.data[timeSeriesKey];
    const historico = [];

    for (const [data, valores] of Object.entries(timeSeries).slice(0, 100)) {
      historico.push({
        data: new Date(data),
        abertura: parseFloat(valores['1. open']),
        fechamento: parseFloat(valores['4. close']),
        maxima: parseFloat(valores['2. high']),
        minima: parseFloat(valores['3. low']),
        volume: parseInt(valores['5. volume'] || 0)
      });
    }

    return historico.reverse(); // Ordenar por data crescente
  } catch (error) {
    console.error(`Erro ao obter histórico de ${ticker}:`, error.message);
    return [];
  }
}

/**
 * Guardar preço na BD para histórico
 */
async function savePriceHistory(ticker, priceData) {
  try {
    await StockPrice.create({
      ticker,
      ...priceData
    });
  } catch (error) {
    console.error(`Erro ao guardar histórico de ${ticker}:`, error.message);
  }
}

/**
 * Obter histórico de preços da BD (últimos 30 dias)
 */
async function getPriceHistoryFromDB(ticker, days = 30) {
  try {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - days);

    return await StockPrice.find({
      ticker: ticker.toUpperCase(),
      dataAtualizacao: { $gte: dataLimite }
    }).sort({ dataAtualizacao: 1 });
  } catch (error) {
    console.error(`Erro ao obter histórico da BD para ${ticker}:`, error.message);
    return [];
  }
}

/**
 * Atualizar preços de várias ações
 */
async function updateMultipleStockPrices(tickers) {
  const results = {};

  for (const ticker of tickers) {
    const priceData = await getStockPrice(ticker);
    if (priceData) {
      results[ticker] = priceData;
      await savePriceHistory(ticker, priceData);
      // Respeitar limite de chamadas da API (5 por minuto com API key gratuita)
      await new Promise(resolve => setTimeout(resolve, 12000));
    }
  }

  return results;
}

module.exports = {
  getStockPrice,
  getStockHistory,
  savePriceHistory,
  getPriceHistoryFromDB,
  updateMultipleStockPrices
};
