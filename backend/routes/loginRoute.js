const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Veuillez remplir tous les champs' });
    }

    // Vérification de l'email dans la table 'admins' pour un administrateur
    db.query('SELECT * FROM admins WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err });

        // Si un administrateur est trouvé
        if (results.length > 0) {
            const admin = results[0];
            // Vérification directe pour l'administrateur (temporaire)
            if (password === admin.password) {
                const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
                return res.json({ message: 'Connexion administrateur réussie', token, role: 'admin' });
            } else {
                return res.status(401).json({ error: 'Mot de passe incorrect' });
            }
        }

        // Si aucun administrateur n'est trouvé, vérifier dans la table 'users' pour un utilisateur normal
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) return res.status(500).json({ error: err });
            if (results.length === 0) return res.status(401).json({ error: 'Utilisateur non trouvé' });

            const user = results[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ error: 'Mot de passe incorrect' });

            // Générer un token JWT pour l'utilisateur normal
            const token = jwt.sign({ id: user.id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ message: 'Connexion réussie', token, role: 'user' });
        });
    });
});

module.exports = router;
