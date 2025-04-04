const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const loginRoute = require('./routes/loginRoute');
const registerRoute = require('./routes/registerRoute');
const auth = require('./routes/auth');
const adminRoute = require('./routes/administrateur');
const path = require('path');

app.use(cors());
app.use(bodyParser.json());
// Servir les fichiers statiques du dossier uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/login', loginRoute);
app.use('/api/register', registerRoute);
app.use('/api/auth', auth);
app.use('/api/administrateur', adminRoute);


const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Serveur démarré sur le port ${PORT} `));
