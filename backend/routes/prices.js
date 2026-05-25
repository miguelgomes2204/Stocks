const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getStockPrice, getPriceHistoryFromDB, updateMultipleStockPrices } = require('../services/alphaVantageService');

const router = express.Router();

// ========== OBTER PREÇO ATUAL DE UM STOCK ==========
router.get('/price/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    if (!ticker || ticker.length === 0) {
      return res.status(400).json({ error: 'Ticker é obrigatório' });
    }

    const priceData = await getStockPrice(ticker.toUpperCase());

    if (!priceData) {
      return res.status(404).json({ error: `Não foi possível obter dados para ${ticker}` });
    }

    res.json({
      success: true,
      data: priceData
    });
  } catch (error) {
    console.error('Erro ao obter preço:', error);
    res.status(500).json({ error: 'Erro ao obter preço do stock' });
  }
});

// ========== OBTER HISTÓRICO DE PREÇOS ==========
router.get('/history/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 30 } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker é obrigatório' });
    }

    const history = await getPriceHistoryFromDB(ticker.toUpperCase(), parseInt(days));

    res.json({
      success: true,
      ticker: ticker.toUpperCase(),
      dias: parseInt(days),
      total: history.length,
      data: history
    });
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    res.status(500).json({ error: 'Erro ao obter histórico de preços' });
  }
});

// ========== OBTER PREÇOS DE MÚLTIPLOS STOCKS ==========
router.post('/prices', async (req, res) => {
  try {
    const { tickers } = req.body;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Insira uma lista de tickers válida' });
    }

    // Limite de 10 stocks por vez para não sobrecarregar a API
    if (tickers.length > 10) {
      return res.status(400).json({ error: 'Máximo de 10 tickers por vez' });
    }

    const prices = {};
    for (const ticker of tickers) {
      const priceData = await getStockPrice(ticker.toUpperCase());
      if (priceData) {
        prices[ticker] = priceData;
      }
    }

    res.json({
      success: true,
      total: Object.keys(prices).length,
      data: prices
    });
  } catch (error) {
    console.error('Erro ao obter múltiplos preços:', error);
    res.status(500).json({ error: 'Erro ao obter preços dos stocks' });
  }
});

// ========== ENDPOINT DE TESTE COM STOCKS EXEMPLO ==========
router.get('/example-stocks', async (req, res) => {
  try {
    const exampleStocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
    const prices = {};

    for (const ticker of exampleStocks) {
      const priceData = await getStockPrice(ticker);
      if (priceData) {
        prices[ticker] = priceData;
      }
      // Delay para respeitar rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({
      success: true,
      message: 'Dados de exemplo de stocks (pode levar alguns segundos)',
      data: prices
    });
  } catch (error) {
    console.error('Erro ao obter stocks de exemplo:', error);
    res.status(500).json({ error: 'Erro ao obter stocks de exemplo' });
  }
});

module.exports = router;
