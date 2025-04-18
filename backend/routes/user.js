const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware d'authentification intégré
const authMiddleware = (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Ajoute les données de l'utilisateur à la requête
    
    next(); // Passe à la route
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// Route pour récupérer le profil de l'utilisateur connecté avec middleware intégré
router.get('/profile', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    
    db.query(
      `SELECT id, name, email, telephone, cin FROM users WHERE id = ?`,
      [userId],
      function(err, results) {
        if (err) {
          console.error('Erreur lors de la récupération du profil:', err);
          return res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
        }
        
        if (results.length === 0) {
          return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        // Ne pas renvoyer le mot de passe même s'il est haché
        const user = results[0];
        
        res.status(200).json({
          id: user.id,
          name: user.name,
          email: user.email,
          telephone: user.telephone || '', // Gestion des valeurs nulles
          cin: user.cin || '' // Gestion des valeurs nulles
        });
      }
    );
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// Route pour mettre à jour le profil de l'utilisateur connecté avec middleware intégré
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { name, telephone, cin } = req.body;
    
    // Validation des données
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Le nom est obligatoire' });
    }
    
    db.query(
      `UPDATE users SET name = ?, telephone = ?, cin = ? WHERE id = ?`,
      [name, telephone || null, cin || null, userId],
      function(err, results) {
        if (err) {
          console.error('Erreur lors de la mise à jour du profil:', err);
          return res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
        }
        
        if (results.affectedRows === 0) {
          return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        res.status(200).json({ 
          message: 'Profil mis à jour avec succès',
          user: {
            id: userId,
            name,
            telephone: telephone || '',
            cin: cin || ''
          }
        });
      }
    );
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
});

module.exports = router;