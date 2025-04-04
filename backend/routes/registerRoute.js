const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();


router.post('/', (req, res) => {
    console.log("Route /api/register appelée !");
    const { name, email, password, telephone, cin } = req.body;

    console.log("Données reçues:", req.body);

    if (!name || !email || !password || !telephone || !cin) {
        console.log("Erreur: Champs manquants");
        return res.status(400).json({ error: 'Veuillez remplir tous les champs' });
    }

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.log("Erreur MySQL:", err);
            return res.status(500).json({ error: err });
        }
        if (results.length > 0) {
            console.log("Erreur: Email déjà utilisé");
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query('INSERT INTO users (name, email, password, telephone, cin) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, telephone, cin],
            (err, result) => {
                if (err) {
                    console.log("Erreur lors de l'insertion dans la base de données:", err);
                    return res.status(500).json({ error: err });
                }
                console.log("Utilisateur inscrit avec succès");
                res.status(201).json({ message: 'Utilisateur inscrit avec succès' });
            }
        );
    });
});

module.exports = router;