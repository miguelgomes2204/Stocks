const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tipo: {
    type: String,
    enum: ['COMPRA', 'VENDA'],
    required: true,
  },
  ticker: {
    type: String,
    required: true,
    uppercase: true,
  },
  quantidade: {
    type: Number,
    required: true,
    min: 1,
  },
  precoExecutado: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  saldoAntes: {
    type: Number,
    required: true,
  },
  saldoDepois: {
    type: Number,
    required: true,
  },
  lucroVenda: {
    type: Number,
    default: 0,
  },
  data: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['PENDENTE', 'EXECUTADA', 'CANCELADA'],
    default: 'EXECUTADA',
  },
  descricao: String,
});

// Index para queries rápidas
transactionSchema.index({ userId: 1, data: -1 });
transactionSchema.index({ userId: 1, ticker: 1 });
transactionSchema.index({ data: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
