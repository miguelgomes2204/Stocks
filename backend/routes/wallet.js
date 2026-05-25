const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const alphaVantageService = require('../services/alphaVantageService');
const Big = require('big.js');
const yup = require('yup');

// ===== GET: Obter carteira completa do utilizador =====
router.get('/', auth, async (req, res) => {
  try {
    const positions = await Wallet.find({ userId: req.userId }).sort({
      criadoEm: -1,
    });

    // Obter saldos do utilizador
    const user = await User.findById(req.userId);

    res.json({
      success: true,
      data: {
        positions,
        saldo: user.saldo,
        saldoInvestido: user.saldoInvestido,
        saldoTotal: user.saldoTotal,
        lucroTotal: user.lucroTotal,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== GET: Resumo da carteira =====
router.get('/summary', auth, async (req, res) => {
  try {
    const positions = await Wallet.find({ userId: req.userId });
    const user = await User.findById(req.userId);

    // Calcular totais
    let totalInvestido = 0;
    let totalAtual = 0;
    let lucroTotal = 0;

    positions.forEach((pos) => {
      totalInvestido += pos.totalInvestido;
      totalAtual += pos.totalAtual;
      lucroTotal += pos.lucroPerda;
    });

    const variacao =
      totalInvestido > 0
        ? parseFloat(
            new Big(lucroTotal).div(totalInvestido).times(100).toFixed(2)
          )
        : 0;

    res.json({
      success: true,
      data: {
        saldoDisponível: user.saldo,
        totalInvestido: parseFloat(totalInvestido.toFixed(2)),
        totalAtual: parseFloat(totalAtual.toFixed(2)),
        lucroPerda: parseFloat(lucroTotal.toFixed(2)),
        variacao: variacao,
        posições: positions.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== POST: Comprar stock =====
router.post('/buy', auth, async (req, res) => {
  try {
    const { ticker, quantidade } = req.body;

    // Validação
    const schema = yup.object().shape({
      ticker: yup
        .string()
        .required('Ticker é obrigatório')
        .max(5, 'Ticker inválido'),
      quantidade: yup
        .number()
        .required('Quantidade é obrigatória')
        .min(1, 'Quantidade deve ser >= 1')
        .max(10000, 'Quantidade máxima: 10.000 shares'),
    });

    await schema.validate({ ticker, quantidade });

    // Obter preço atual
    const priceData = await alphaVantageService.getStockPrice(ticker);
    if (!priceData || !priceData.price) {
      return res.status(400).json({
        success: false,
        message: 'Stock não encontrado ou API indisponível',
      });
    }

    const precoAtual = priceData.price;
    const total = parseFloat(
      new Big(precoAtual).times(quantidade).toFixed(2)
    );

    // Obter utilizador e validar saldo
    const user = await User.findById(req.userId);
    if (user.saldo < total) {
      return res.status(400).json({
        success: false,
        message: `Saldo insuficiente. Disponível: €${user.saldo.toFixed(2)}, Necessário: €${total.toFixed(
          2
        )}`,
      });
    }

    // Verificar se já tem posição neste ticker
    let wallet = await Wallet.findOne({
      userId: req.userId,
      ticker: ticker.toUpperCase(),
    });

    if (wallet) {
      // Atualizar posição existente
      const novaQuantidade = wallet.quantidade + quantidade;
      const novoPrecoMédio = parseFloat(
        new Big(wallet.totalInvestido)
          .plus(total)
          .div(novaQuantidade)
          .toFixed(2)
      );

      wallet.quantidade = novaQuantidade;
      wallet.precoMédio = novoPrecoMédio;
      wallet.precoAtual = precoAtual;
    } else {
      // Criar nova posição
      wallet = new Wallet({
        userId: req.userId,
        ticker: ticker.toUpperCase(),
        quantidade: quantidade,
        precoMédio: precoAtual,
        precoAtual: precoAtual,
      });
    }

    await wallet.save();

    // Atualizar saldo do utilizador
    user.saldo = parseFloat(new Big(user.saldo).minus(total).toFixed(2));
    user.saldoInvestido = parseFloat(
      new Big(user.saldoInvestido).plus(total).toFixed(2)
    );
    user.saldoTotal = parseFloat(
      new Big(user.saldo).plus(user.saldoInvestido).toFixed(2)
    );
    await user.save();

    // Registar transação
    const transaction = new Transaction({
      userId: req.userId,
      tipo: 'COMPRA',
      ticker: ticker.toUpperCase(),
      quantidade: quantidade,
      precoExecutado: precoAtual,
      total: total,
      saldoAntes: parseFloat(
        new Big(user.saldo).plus(total).toFixed(2)
      ), // Saldo antes da compra
      saldoDepois: user.saldo,
      descricao: `Compra de ${quantidade} shares de ${ticker.toUpperCase()} a €${precoAtual.toFixed(
        2
      )}`,
    });
    await transaction.save();

    res.json({
      success: true,
      message: `Compra de ${quantidade} shares de ${ticker.toUpperCase()} executada com sucesso!`,
      data: {
        wallet,
        saldoAtual: user.saldo,
        transacao: transaction,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== POST: Vender stock =====
router.post('/sell', auth, async (req, res) => {
  try {
    const { ticker, quantidade } = req.body;

    // Validação
    const schema = yup.object().shape({
      ticker: yup
        .string()
        .required('Ticker é obrigatório')
        .max(5, 'Ticker inválido'),
      quantidade: yup
        .number()
        .required('Quantidade é obrigatória')
        .min(1, 'Quantidade deve ser >= 1'),
    });

    await schema.validate({ ticker, quantidade });

    // Obter posição atual
    const wallet = await Wallet.findOne({
      userId: req.userId,
      ticker: ticker.toUpperCase(),
    });

    if (!wallet || wallet.quantidade < quantidade) {
      return res.status(400).json({
        success: false,
        message: `Você não tem ${quantidade} shares de ${ticker.toUpperCase()}. Disponível: ${wallet ? wallet.quantidade : 0}`,
      });
    }

    // Obter preço atual
    const priceData = await alphaVantageService.getStockPrice(ticker);
    if (!priceData || !priceData.price) {
      return res.status(400).json({
        success: false,
        message: 'Stock não encontrado ou API indisponível',
      });
    }

    const precoAtual = priceData.price;
    const totalVenda = parseFloat(
      new Big(precoAtual).times(quantidade).toFixed(2)
    );

    // Calcular lucro/perda
    const preçoInvestidoQtd = parseFloat(
      new Big(wallet.precoMédio).times(quantidade).toFixed(2)
    );
    const lucroVenda = parseFloat(
      new Big(totalVenda).minus(preçoInvestidoQtd).toFixed(2)
    );

    // Atualizar ou remover posição
    if (wallet.quantidade === quantidade) {
      // Remover posição completamente
      await Wallet.findByIdAndDelete(wallet._id);
    } else {
      // Reduzir quantidade
      wallet.quantidade -= quantidade;
      wallet.precoAtual = precoAtual;
      await wallet.save();
    }

    // Atualizar saldo do utilizador
    const user = await User.findById(req.userId);
    user.saldo = parseFloat(
      new Big(user.saldo).plus(totalVenda).toFixed(2)
    );
    user.saldoInvestido = parseFloat(
      new Big(user.saldoInvestido).minus(preçoInvestidoQtd).toFixed(2)
    );
    user.saldoTotal = parseFloat(
      new Big(user.saldo).plus(user.saldoInvestido).toFixed(2)
    );
    user.lucroTotal = parseFloat(
      new Big(user.lucroTotal).plus(lucroVenda).toFixed(2)
    );
    await user.save();

    // Registar transação
    const transaction = new Transaction({
      userId: req.userId,
      tipo: 'VENDA',
      ticker: ticker.toUpperCase(),
      quantidade: quantidade,
      precoExecutado: precoAtual,
      total: totalVenda,
      saldoAntes: parseFloat(
        new Big(user.saldo).minus(totalVenda).toFixed(2)
      ), // Saldo antes da venda
      saldoDepois: user.saldo,
      lucroVenda: lucroVenda,
      descricao: `Venda de ${quantidade} shares de ${ticker.toUpperCase()} a €${precoAtual.toFixed(
        2
      )}. Lucro: €${lucroVenda.toFixed(2)}`,
    });
    await transaction.save();

    res.json({
      success: true,
      message: `Venda de ${quantidade} shares de ${ticker.toUpperCase()} executada com sucesso!`,
      data: {
        saldoAtual: user.saldo,
        lucroVenda: lucroVenda,
        transacao: transaction,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== GET: Histórico de transações =====
router.get('/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ data: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ userId: req.userId });

    res.json({
      success: true,
      data: {
        transactions,
        paginacao: {
          total,
          pagina: page,
          páginas: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== GET: Estatísticas de transações =====
router.get('/transactions/stats', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId });

    let totalComprado = 0;
    let totalVendido = 0;
    let totalLucro = 0;
    let compras = 0;
    let vendas = 0;

    transactions.forEach((t) => {
      if (t.tipo === 'COMPRA') {
        totalComprado += t.total;
        compras++;
      } else {
        totalVendido += t.total;
        vendas++;
        totalLucro += t.lucroVenda;
      }
    });

    res.json({
      success: true,
      data: {
        totalComprado: parseFloat(totalComprado.toFixed(2)),
        totalVendido: parseFloat(totalVendido.toFixed(2)),
        totalLucro: parseFloat(totalLucro.toFixed(2)),
        compras,
        vendas,
        transações: transactions.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
