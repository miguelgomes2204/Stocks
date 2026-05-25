const mongoose = require('mongoose');
const Big = require('big.js');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    min: 0,
  },
  precoMédio: {
    type: Number,
    required: true,
  },
  precoAtual: {
    type: Number,
    required: true,
  },
  totalInvestido: {
    type: Number,
    required: true,
  },
  totalAtual: {
    type: Number,
    required: true,
  },
  lucroPerda: {
    type: Number,
    default: 0,
  },
  variacao: {
    type: Number,
    default: 0,
  },
  criadoEm: {
    type: Date,
    default: Date.now,
  },
  atualizadoEm: {
    type: Date,
    default: Date.now,
  },
});

// Index para queries rápidas
walletSchema.index({ userId: 1, ticker: 1 }, { unique: true });
walletSchema.index({ userId: 1 });

// Middleware para atualizar lucro/perda antes de salvar
walletSchema.pre('save', function(next) {
  if (this.quantidade > 0) {
    this.totalInvestido = parseFloat(
      new Big(this.precoMédio).times(this.quantidade).toFixed(2)
    );
    this.totalAtual = parseFloat(
      new Big(this.precoAtual).times(this.quantidade).toFixed(2)
    );
    this.lucroPerda = parseFloat(
      new Big(this.totalAtual).minus(this.totalInvestido).toFixed(2)
    );
    this.variacao = parseFloat(
      new Big(this.lucroPerda)
        .div(this.totalInvestido)
        .times(100)
        .toFixed(2)
    );
  } else {
    this.totalInvestido = 0;
    this.totalAtual = 0;
    this.lucroPerda = 0;
    this.variacao = 0;
  }
  this.atualizadoEm = Date.now();
  next();
});

module.exports = mongoose.model('Wallet', walletSchema);
