const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'O userId é obrigatório']
  },
  ticker: {
    type: String,
    required: [true, 'O ticker é obrigatório'],
    trim: true,
    uppercase: true
  },
  empresa: {
    type: String,
    required: [true, 'O nome da empresa é obrigatório'],
    trim: true
  },
  dataCompra: {
    type: Date,
    required: [true, 'A data de compra é obrigatória'],
    default: Date.now
  },
  quantidade: {
    type: Number,
    required: [true, 'A quantidade é obrigatória'],
    min: [0, 'A quantidade não pode ser negativa']
  },
  precoCompra: {
    type: Number,
    required: [true, 'O preço de compra é obrigatório'],
    min: [0, 'O preço de compra não pode ser negativo']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Stock', StockSchema);
