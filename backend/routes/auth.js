const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ========== REGISTO ==========
router.post('/register', async (req, res) => {
  try {
    const { nome, email, password, passwordConfirm } = req.body;

    // Validações
    if (!nome || !email || !password) {
      return res.status(400).json({ error: 'Por favor preencha todos os campos obrigatórios' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'As passwords não correspondem' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A password deve ter no mínimo 6 caracteres' });
    }

    // Verificar se o email já existe
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ error: 'Este email já está registado' });
    }

    // Criar novo utilizador
    const user = await User.create({
      nome,
      email: email.toLowerCase(),
      password
    });

    // Gerar JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Utilizador registado com sucesso',
      token,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Erro ao registar:', error);
    res.status(500).json({ error: 'Erro ao registar o utilizador' });
  }
});

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor insira email e password' });
    }

    // Buscar utilizador e incluir password (normalmente não é retornada)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Email ou password incorretos' });
    }

    // Verificar password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou password incorretos' });
    }

    // Gerar JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// ========== OBTER PERFIL (Protegido) ==========
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter perfil' });
  }
});

// ========== LOGOUT (apenas no frontend) ==========
router.post('/logout', authMiddleware, (req, res) => {
  // JWT é stateless, logout é feito no frontend apagando o token
  res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = router;
