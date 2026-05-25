const mongoose = require('mongoose');

const StockPriceSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  empresa: {
    type: String,
    trim: true
  },
  preco: {
    type: Number,
    required: true
  },
  precoAnterior: {
    type: Number
  },
  variacao: {
    type: Number // Variação em %
  },
  volume: {
    type: Number
  },
  dataAtualizacao: {
    type: Date,
    default: Date.now,
    index: true
  },
  fonte: {
    type: String,
    enum: ['alpha_vantage', 'finnhub', 'mock'],
    default: 'alpha_vantage'
  }
}, {
  timestamps: true
});

// Índice composto para queries rápidas
StockPriceSchema.index({ ticker: 1, dataAtualizacao: -1 });

module.exports = mongoose.model('StockPrice', StockPriceSchema);
