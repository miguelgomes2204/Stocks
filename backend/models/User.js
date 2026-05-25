const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'O nome é obrigatório'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'O email é obrigatório'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor insira um email válido']
  },
  password: {
    type: String,
    required: [true, 'A password é obrigatória'],
    minlength: [6, 'A password deve ter no mínimo 6 caracteres'],
    select: false // Não retorna password por padrão
  },
  dataCriacao: {
    type: Date,
    default: Date.now
  },
  // Campos de saldo para carteira de investimentos
  saldo: {
    type: Number,
    default: 100000, // €100.000 saldo inicial
    min: 0
  },
  saldoInvestido: {
    type: Number,
    default: 0,
    min: 0
  },
  saldoTotal: {
    type: Number,
    default: 100000
  },
  lucroTotal: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Middleware: Hash da password antes de guardar
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar passwords
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
