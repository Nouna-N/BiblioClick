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

// Fonction de validation des données du livre
const validateBookData = (req, res, next) => {
  const { titre, auteur, isbn } = req.body;
  
  // Validation basique
  if (!titre || !auteur || !isbn) {
    return res.status(400).json({ error: 'Le titre, l\'auteur et l\'ISBN sont obligatoires' });
  }
  
  next();
};

// Ajouter un livre
router.post('/add', upload.single('image'), validateBookData, (req, res) => {
  try {
    const { titre, auteur, isbn, genre, annee_publication, total_copies, copies_disponibles } = req.body;
    
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

// Route pour obtenir tous les livres (optimisée pour HomeScreen)
router.get('/', (req, res) => {
  const sql = 'SELECT id as _id, titre, auteur, image FROM books ORDER BY titre ASC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erreur DB:', err);
      return res.status(500).json({ 
        error: 'Database error',
        message: err.message 
      });
    }
    
    // Transformer les chemins d'images en URLs complètes
    const books = results.map(book => ({
      ...book,
      image: book.image ? `http://${req.get('host')}${book.image}` : null
    }));
    
    res.json(books);
  });
});

// Route pour les détails d'un livre spécifique
router.get('/:id', (req, res) => {
  const sql = 'SELECT * FROM books WHERE id = ?';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Livre non trouvé' });
    
    const book = {
      ...results[0],
      _id: results[0].id, // Pour compatibilité avec le frontend
      image: results[0].image ? `http://${req.get('host')}${results[0].image}` : null
    };
    
    res.json(book);
  });
});

// Mettre à jour un livre
router.put('/:id', upload.single('image'), validateBookData, (req, res) => {
  const { id } = req.params;
  const bookData = req.body;
  
  // 1. Récupérer d'abord le livre existant
  db.query('SELECT * FROM books WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Livre non trouvé' });
    
    const existingBook = results[0];
    const imagePath = req.file ? `/uploads/${req.file.filename}` : existingBook.image;
    
    const sql = `
      UPDATE books 
      SET titre=?, auteur=?, isbn=?, genre=?, annee_publication=?, 
          total_copies=?, copies_disponibles=?, image=?
      WHERE id=?
    `;
    
    const params = [
      bookData.titre,
      bookData.auteur,
      bookData.isbn,
      bookData.genre || null,
      bookData.annee_publication || null,
      bookData.total_copies || 0,
      bookData.copies_disponibles || 0,
      imagePath,
      id
    ];
    
    db.query(sql, params, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Construire l'objet livre mis à jour avec l'URL complète de l'image
      const updatedBook = {
        _id: id,
        id: id,
        titre: bookData.titre,
        auteur: bookData.auteur,
        isbn: bookData.isbn,
        genre: bookData.genre || null,
        annee_publication: bookData.annee_publication || null,
        total_copies: bookData.total_copies || 0,
        copies_disponibles: bookData.copies_disponibles || 0,
        image: imagePath ? `http://${req.get('host')}${imagePath}` : null
      };
      
      res.json(updatedBook);
    });
  });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // Vérifier d'abord si le livre existe
  db.query('SELECT * FROM books WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Livre non trouvé' });
    
    // Supprimer le livre
    db.query('DELETE FROM books WHERE id = ?', [id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({ 
        message: 'Livre supprimé avec succès',
        id: id
      });
    });
  });
});

module.exports = router;