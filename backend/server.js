require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexport';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão ao MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('=== Base de dados ligada com sucesso ao MongoDB ===');
    console.log(`URI: ${MONGODB_URI}`);
  })
  .catch((err) => {
    console.error('\n======================================================');
    console.error('ERRO: Não foi possível ligar ao MongoDB.');
    console.error(`Detalhes do Erro: ${err.message || err}`);
    console.error(`URI de Ligação: ${MONGODB_URI}`);
    console.error('Instruções adicionais:');
    console.error('1. Certifique-se de que o MongoDB está instalado e a correr localmente.');
    console.error('2. Caso use o MongoDB Atlas, adicione a connection string correta no ficheiro backend/.env.');
    console.error('======================================================\n');
    // Para evitar que a execução bloqueie e para dar oportunidade de corrigir o .env,
    // não faremos process.exit(1), permitindo que o Express corra mesmo sem base de dados ligada inicialmente.
  });

// Rota de Teste de Saúde da API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Importar e Registar Rotas
const stocksRouter = require('./routes/stocks');
const authRouter = require('./routes/auth');
const pricesRouter = require('./routes/prices');
const marketRouter = require('./routes/market');
const walletRouter = require('./routes/wallet');

app.use('/api/auth', authRouter);
app.use('/api/carteira', stocksRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/market', marketRouter);
app.use('/api/wallet', walletRouter);

// Handler de Erro Global
app.use((err, req, res, next) => {
  console.error('Erro geral no servidor:', err.stack);
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`=== Servidor NexPort a correr na porta ${PORT} ===`);
  console.log(`API Carteira: http://localhost:${PORT}/api/carteira`);
  console.log(`API Mercado:  http://localhost:${PORT}/api/market`);
  console.log(`Verificação de Estado: http://localhost:${PORT}/api/health`);
});
