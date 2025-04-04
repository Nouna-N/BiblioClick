const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// request-reset
router.post('/request-reset', (req, res) => {
  const { email } = req.body;

  // 1) Vérifier si l'utilisateur existe
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (results.length === 0) {
      return res.status(404).json({ message: "Email introuvable" });
    }

    // 2) Générer le code et mettre à jour la base
    const code = Math.floor(100000 + Math.random() * 900000); // 6 chiffres
    db.query(
      "UPDATE users SET reset_code = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ?",
      [code, email],
      (err2) => {
        if (err2) return res.status(500).json({ message: "Erreur serveur" });

        // À FAIRE : envoyer le code par email (via nodemailer)
        console.log("Code de vérification :", code);

        res.json({ message: "Code de vérification envoyé" });
      }
    );
  });
});

// verify-code
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_expires > NOW()",
    [email, code],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      if (results.length === 0) {
        return res.status(400).json({ message: "Code invalide ou expiré" });
      }

      res.json({ message: "Code vérifié avec succès" });
    }
  );
});

// reset-password
router.post('/reset-password', (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email et nouveau mot de passe requis" });
  }

  // 1) Hacher le mot de passe en callback
  bcrypt.hash(newPassword, 10, (errHash, hashedPassword) => {
    if (errHash) {
      return res.status(500).json({ message: "Erreur lors du hachage du mot de passe" });
    }

    // 2) Mettre à jour la base
    db.query(
      "UPDATE users SET password = ?, reset_code = NULL, reset_expires = NULL WHERE email = ?",
      [hashedPassword, email],
      (errUpdate) => {
        if (errUpdate) return res.status(500).json({ message: "Erreur serveur" });

        res.json({ message: "Mot de passe réinitialisé" });
      }
    );
  });
});

module.exports = router;
