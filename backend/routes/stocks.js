const express = require('express');
const router = express.Router();
const axios = require('axios');
const Stock = require('../models/Stock');
const authMiddleware = require('../middleware/auth');

// Aplicar autenticação a todas as rotas da carteira
router.use(authMiddleware);

// Função auxiliar para obter cotações simuladas (mock)
function getMockPrice(ticker) {
  const cleanTicker = ticker.toUpperCase().trim();
  const mockPrices = {
    'AAPL': 189.30, 'MSFT': 421.90, 'GOOGL': 176.40, 'AMZN': 183.85,
    'TSLA': 177.46, 'NVDA': 948.90, 'META': 472.20, 'NFLX': 621.10,
    'PETR4': 38.50, 'VALE3': 64.20, 'JPM': 205.30, 'BRK': 380.50,
    'V': 281.40, 'JNJ': 148.20, 'WMT': 67.80, 'PG': 165.30
  };
  if (mockPrices[cleanTicker]) return mockPrices[cleanTicker];
  let sum = 0;
  for (let i = 0; i < cleanTicker.length; i++) sum += cleanTicker.charCodeAt(i);
  return Number((50 + (sum % 200) + 0.35).toFixed(2));
}

// Obter preço de ação (Finnhub ou fallback mock)
async function getStockPrice(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || apiKey.trim() === '') return getMockPrice(ticker);
  try {
    const response = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol: ticker.toUpperCase().trim(), token: apiKey },
      timeout: 4000
    });
    if (response.data && response.data.c !== undefined && response.data.c > 0) {
      return Number(response.data.c.toFixed(2));
    }
    return getMockPrice(ticker);
  } catch (error) {
    return getMockPrice(ticker);
  }
}

// GET - Listar ações da carteira do utilizador autenticado
router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find({ userId: req.user.id }).sort({ createdAt: -1 });
    const combinedPortfolio = await Promise.all(stocks.map(async (stock) => {
      const cotacaoDia = await getStockPrice(stock.ticker);
      return {
        _id: stock._id,
        ticker: stock.ticker,
        empresa: stock.empresa,
        dataCompra: stock.dataCompra,
        quantidade: stock.quantidade,
        precoCompra: stock.precoCompra,
        cotacaoDia
      };
    }));
    res.json(combinedPortfolio);
  } catch (error) {
    console.error('Erro ao ler a carteira:', error);
    res.status(500).json({ error: 'Erro ao obter dados da carteira.' });
  }
});

// POST - Adicionar nova ação à carteira do utilizador
router.post('/', async (req, res) => {
  try {
    const { ticker, empresa, dataCompra, quantidade, precoCompra } = req.body;
    if (!ticker || !empresa || !quantidade || !precoCompra) {
      return res.status(400).json({ error: 'Os campos Ticker, Empresa, Quantidade e Preço de Compra são obrigatórios.' });
    }
    const newStock = new Stock({
      userId: req.user.id,
      ticker,
      empresa,
      dataCompra: dataCompra || new Date(),
      quantidade: Number(quantidade),
      precoCompra: Number(precoCompra)
    });
    const savedStock = await newStock.save();
    res.status(201).json(savedStock);
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
    res.status(500).json({ error: 'Erro ao guardar ação na carteira.' });
  }
});

// DELETE - Remover ação (apenas se pertencer ao utilizador)
router.delete('/:id', async (req, res) => {
  try {
    const stock = await Stock.findOne({ _id: req.params.id, userId: req.user.id });
    if (!stock) return res.status(404).json({ error: 'Ação não encontrada.' });
    await Stock.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ação removida com sucesso da carteira.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover ação da carteira.' });
  }
});

module.exports = router;
