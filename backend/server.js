const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware pour le débogage
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(cors());

// Limite de taille pour bodyParser
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const loginRoute = require('./routes/loginRoute');
const registerRoute = require('./routes/registerRoute');
const auth = require('./routes/auth');
const adminRoute = require('./routes/administrateur');
const empruntRoutes = require('./routes/emprunt');
const userRoute = require('./routes/user');


app.use('/api/login', loginRoute);
app.use('/api/register', registerRoute);
app.use('/api/auth', auth);
app.use('/api/administrateur', adminRoute);
app.use('/api/emprunt', empruntRoutes);
app.use('/api/user', userRoute);

// Gestion d'erreur globale
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  res.status(500).json({ 
    error: 'Erreur serveur', 
    message: err.message 
  });
});

app.listen(5000, '0.0.0.0', () => {
  console.log("Serveur backend lancé sur le port 5000");
});