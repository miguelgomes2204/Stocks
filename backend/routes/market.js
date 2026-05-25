const express = require('express');
const router = express.Router();
const axios = require('axios');

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

// Base de dados de empresas populares para pesquisa
const COMPANIES_DB = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', country: 'US' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', country: 'US' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', country: 'US' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', country: 'US' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive', country: 'US' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', country: 'US' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', country: 'US' },
  { ticker: 'NFLX', name: 'Netflix Inc.', sector: 'Entertainment', country: 'US' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', country: 'US' },
  { ticker: 'V', name: 'Visa Inc.', sector: 'Financial Services', country: 'US' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', country: 'US' },
  { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', country: 'US' },
  { ticker: 'DIS', name: 'The Walt Disney Company', sector: 'Entertainment', country: 'US' },
  { ticker: 'PYPL', name: 'PayPal Holdings Inc.', sector: 'Financial Services', country: 'US' },
  { ticker: 'INTC', name: 'Intel Corporation', sector: 'Technology', country: 'US' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', country: 'US' },
  { ticker: 'BABA', name: 'Alibaba Group', sector: 'Consumer Cyclical', country: 'CN' },
  { ticker: 'PETR4', name: 'Petrobras', sector: 'Energy', country: 'BR' },
  { ticker: 'VALE3', name: 'Vale S.A.', sector: 'Basic Materials', country: 'BR' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco', sector: 'Financial Services', country: 'BR' },
  { ticker: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer Cyclical', country: 'US' },
  { ticker: 'COIN', name: 'Coinbase Global Inc.', sector: 'Financial Services', country: 'US' },
  { ticker: 'SQ', name: 'Block Inc.', sector: 'Technology', country: 'US' },
  { ticker: 'SPOT', name: 'Spotify Technology', sector: 'Entertainment', country: 'SE' },
  { ticker: 'UBER', name: 'Uber Technologies', sector: 'Technology', country: 'US' },
  { ticker: 'ABNB', name: 'Airbnb Inc.', sector: 'Consumer Cyclical', country: 'US' },
  { ticker: 'PLTR', name: 'Palantir Technologies', sector: 'Technology', country: 'US' },
  { ticker: 'RIVN', name: 'Rivian Automotive', sector: 'Automotive', country: 'US' },
];

// Preços base para mock realista
const BASE_PRICES = {
  'AAPL': 189.30, 'MSFT': 421.90, 'GOOGL': 176.40, 'AMZN': 183.85,
  'TSLA': 177.46, 'NVDA': 948.90, 'META': 472.20, 'NFLX': 621.10,
  'JPM': 205.30, 'V': 281.40, 'JNJ': 148.20, 'WMT': 67.80,
  'DIS': 92.10, 'PYPL': 61.40, 'INTC': 30.80, 'AMD': 174.60,
  'BABA': 77.30, 'PETR4': 38.50, 'VALE3': 64.20, 'ITUB4': 32.40,
  'SBUX': 77.90, 'COIN': 213.40, 'SQ': 68.30, 'SPOT': 318.70,
  'UBER': 72.80, 'ABNB': 129.40, 'PLTR': 24.60, 'RIVN': 11.20,
};

function getBasePrice(ticker) {
  if (BASE_PRICES[ticker]) return BASE_PRICES[ticker];
  let sum = 0;
  for (let i = 0; i < ticker.length; i++) sum += ticker.charCodeAt(i);
  return Number((50 + (sum % 200) + 0.35).toFixed(2));
}

// Gerar histórico OHLC simulado realista
function generateMockHistory(ticker, days) {
  const basePrice = getBasePrice(ticker);
  const history = [];
  const now = new Date();
  let price = basePrice * (0.7 + Math.random() * 0.3); // começa um pouco abaixo

  // Seed determinístico baseado no ticker para consistência
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed += ticker.charCodeAt(i);

  function seededRandom(s) {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Skip weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Volatilidade diária entre -3% e +3%
    const volatility = 0.03;
    const r1 = seededRandom(seed + i * 17);
    const r2 = seededRandom(seed + i * 31);
    const r3 = seededRandom(seed + i * 53);
    const r4 = seededRandom(seed + i * 73);

    const change = (r1 - 0.48) * volatility * 2;
    price = price * (1 + change);
    price = Math.max(price, basePrice * 0.3); // floor de segurança

    const open = price * (1 + (r2 - 0.5) * 0.005);
    const close = price;
    const high = Math.max(open, close) * (1 + r3 * 0.012);
    const low = Math.min(open, close) * (1 - r4 * 0.012);
    const volume = Math.floor(1000000 + r1 * 50000000);

    history.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    });
  }

  // Forçar último preço para o preço atual real se disponível
  if (history.length > 0) {
    history[history.length - 1].close = basePrice;
  }

  return history;
}

// GET /api/market/search?q=AAPL
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return res.json({ results: COMPANIES_DB.slice(0, 10) });
    }
    const query = q.toUpperCase().trim();
    const results = COMPANIES_DB.filter(c =>
      c.ticker.includes(query) ||
      c.name.toUpperCase().includes(query) ||
      c.sector.toUpperCase().includes(query)
    ).slice(0, 10);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Erro na pesquisa' });
  }
});

// GET /api/market/history/:ticker?period=1M
router.get('/history/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { period = '1M' } = req.query;

    const periodDays = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days = periodDays[period] || 30;

    // Tentar Finnhub para dados reais (se disponível)
    if (FINNHUB_KEY) {
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - (days * 24 * 3600);
        const resolution = days <= 7 ? '60' : 'D';

        const response = await axios.get('https://finnhub.io/api/v1/stock/candle', {
          params: { symbol: ticker.toUpperCase(), resolution, from, to, token: FINNHUB_KEY },
          timeout: 5000
        });

        if (response.data && response.data.s === 'ok' && response.data.c) {
          const history = response.data.t.map((timestamp, i) => ({
            date: new Date(timestamp * 1000).toISOString().split('T')[0],
            open: Number(response.data.o[i].toFixed(2)),
            high: Number(response.data.h[i].toFixed(2)),
            low: Number(response.data.l[i].toFixed(2)),
            close: Number(response.data.c[i].toFixed(2)),
            volume: response.data.v[i] || 0
          }));
          return res.json({ ticker: ticker.toUpperCase(), period, source: 'finnhub', data: history });
        }
      } catch (e) {
        // Fallback para mock
      }
    }

    // Gerar mock realista
    const history = generateMockHistory(ticker.toUpperCase(), days);
    res.json({ ticker: ticker.toUpperCase(), period, source: 'mock', data: history });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter histórico' });
  }
});

// GET /api/market/trending
router.get('/trending', async (req, res) => {
  try {
    const trending = ['AAPL', 'NVDA', 'TSLA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'NFLX'];
    const results = trending.map(ticker => {
      const company = COMPANIES_DB.find(c => c.ticker === ticker);
      const price = getBasePrice(ticker);
      const change = ((Math.random() - 0.48) * 4).toFixed(2);
      return {
        ticker,
        name: company ? company.name : ticker,
        sector: company ? company.sector : 'N/A',
        price,
        change: parseFloat(change),
        changePercent: parseFloat(change)
      };
    });
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter trending' });
  }
});

// GET /api/market/quote/:ticker
router.get('/quote/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const company = COMPANIES_DB.find(c => c.ticker === ticker.toUpperCase());
    const price = getBasePrice(ticker.toUpperCase());
    const change = ((Math.random() - 0.48) * 4).toFixed(2);

    res.json({
      ticker: ticker.toUpperCase(),
      name: company ? company.name : ticker.toUpperCase(),
      sector: company ? company.sector : 'N/A',
      price,
      change: parseFloat(change),
      changePercent: parseFloat(change),
      high52: Number((price * 1.35).toFixed(2)),
      low52: Number((price * 0.68).toFixed(2)),
      marketCap: Math.floor(price * (Math.random() * 5 + 1) * 1e9),
      volume: Math.floor(Math.random() * 50000000 + 5000000)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter quote' });
  }
});

module.exports = router;
