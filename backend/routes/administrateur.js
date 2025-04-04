const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const router = express.Router();

// Configuration de Multer pour les images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

// Filtre pour vérifier les types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté. Seuls JPEG, JPG et PNG sont acceptés.'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // limite à 5MB
  }
});

// Ajouter un livre
router.post('/add', upload.single('image'), (req, res) => {
  try {
    const { titre, auteur, isbn, genre, annee_publication, total_copies, copies_disponibles } = req.body;
    
    // Validation basique
    if (!titre || !auteur || !isbn) {
      return res.status(400).json({ error: 'Le titre, l\'auteur et l\'ISBN sont obligatoires' });
    }
    
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    const sql = 'INSERT INTO books (isbn, titre, auteur, genre, annee_publication, total_copies, copies_disponibles, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    
    db.query(sql, [isbn, titre, auteur, genre, annee_publication, total_copies, copies_disponibles, imagePath], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ 
        message: 'Livre ajouté avec succès',
        id: result.insertId
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer tous les livres
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM books';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Récupérer un livre par son ID
router.get('/:id', (req, res) => {
  const sql = 'SELECT * FROM books WHERE id = ?';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Livre non trouvé' });
    res.json(results[0]);
  });
});

// Mettre à jour un livre
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const { titre, auteur, isbn, genre, annee_publication, total_copies, copies_disponibles } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Si une nouvelle image est fournie, utilisez-la, sinon conservez l'ancienne
    let sql, params;
    if (req.file) {
      sql = 'UPDATE books SET isbn=?, titre=?, auteur=?, genre=?, annee_publication=?, total_copies=?, copies_disponibles=?, image=? WHERE id=?';
      params = [isbn, titre, auteur, genre, annee_publication, total_copies, copies_disponibles, imagePath, req.params.id];
    } else {
      sql = 'UPDATE books SET isbn=?, titre=?, auteur=?, genre=?, annee_publication=?, total_copies=?, copies_disponibles=? WHERE id=?';
      params = [isbn, titre, auteur, genre, annee_publication, total_copies, copies_disponibles, req.params.id];
    }
    
    db.query(sql, params, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Livre non trouvé' });
      res.json({ message: 'Livre mis à jour avec succès' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un livre
router.delete('/:id', (req, res) => {
  const sql = 'DELETE FROM books WHERE id = ?';
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Livre non trouvé' });
    res.json({ message: 'Livre supprimé avec succès' });
  });
});

module.exports = router;