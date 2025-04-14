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

// Route pour obtenir tous les utilisateurs
router.get('/users', (req, res) => {
  const sql = 'SELECT id, name, email, telephone, cin, created_at, updated_at FROM users ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erreur DB:', err);
      return res.status(500).json({ 
        error: 'Database error',
        message: err.message 
      });
    }
    
    res.json(results);
  });
});
// Route spécifique pour les emprunts
router.get('/emprunts', (req, res) => {
  const sql = `
    SELECT e.*,
      u.name as user_name, u.email as user_email,
      b.titre as book_titre, b.auteur as book_auteur
    FROM emprunts e
    JOIN users u ON e.utilisateur_id = u.id
    JOIN books b ON e.livre_id = b.id
    ORDER BY e.date_emprunt DESC
  `;
 
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erreur DB:', err);
      return res.status(500).json({
        error: 'Database error',
        message: err.message
      });
    }
   
    // Restructurer les données
    const formattedEmprunts = results.map(e => ({
      id: e.id,
      date_emprunt: e.date_emprunt,
      date_retour_prevue: e.date_retour_prevue,
      date_retour_effective: e.date_retour_effective,
      status: e.status,
      user: {
        id: e.utilisateur_id,
        name: e.user_name,
        email: e.user_email
      },
      book: {
        id: e.livre_id,
        titre: e.book_titre,
        auteur: e.book_auteur
      }
    }));
   
    res.json(formattedEmprunts);
  });
});

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



// Obtenir un utilisateur spécifique
router.get('/users/:id', (req, res) => {
  const sql = 'SELECT id, name, email, telephone, cin, created_at, updated_at FROM users WHERE id = ?';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    res.json(results[0]);
  });
});

// Ajouter un nouvel utilisateur
router.post('/users', (req, res) => {
  try {
    const { name, email, password, telephone, cin } = req.body;
    
    // Validation basique
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Le nom, l\'email et le mot de passe sont obligatoires' });
    }
    
    // Vérifier si l'email existe déjà
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length > 0) return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      
      // Hash du mot de passe (assurez-vous d'avoir bcrypt configuré)
      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      const sql = 'INSERT INTO users (name, email, password, telephone, cin) VALUES (?, ?, ?, ?, ?)';
      
      db.query(sql, [name, email, hashedPassword, telephone, cin], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
          message: 'Utilisateur ajouté avec succès',
          id: result.insertId
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un utilisateur
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, telephone, cin, password } = req.body;
  
  // Récupérer d'abord l'utilisateur existant
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    // Vérifier si le nouvel email existe déjà (sauf pour l'utilisateur actuel)
    if (email) {
      db.query('SELECT * FROM users WHERE email = ? AND id != ?', [email, id], (err, emailResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (emailResults.length > 0) return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        
        updateUser();
      });
    } else {
      updateUser();
    }
    
    function updateUser() {
      // Préparer les champs à mettre à jour
      const updates = [];
      const params = [];
      
      if (name) {
        updates.push('name = ?');
        params.push(name);
      }
      
      if (email) {
        updates.push('email = ?');
        params.push(email);
      }
      
      if (telephone) {
        updates.push('telephone = ?');
        params.push(telephone);
      }
      
      if (cin) {
        updates.push('cin = ?');
        params.push(cin);
      }
      
      if (password) {
        const bcrypt = require('bcrypt');
        const hashedPassword = bcrypt.hashSync(password, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }
      
      updates.push('updated_at = NOW()');
      
      // Si aucun champ à mettre à jour
      if (updates.length === 1) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour fourni' });
      }
      
      params.push(id); // Pour la clause WHERE
      
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      
      db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({ 
          message: 'Utilisateur mis à jour avec succès',
          id: id
        });
      });
    }
  });
});

// Supprimer un utilisateur
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  
  // Vérifier d'abord si l'utilisateur existe
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    // Vérifier si l'utilisateur a des emprunts en cours
    db.query('SELECT * FROM emprunts WHERE user_id = ? AND date_retour_effective IS NULL', [id], (err, emprunts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (emprunts.length > 0) {
        return res.status(400).json({ 
          error: 'Impossible de supprimer cet utilisateur car il a des emprunts en cours',
          activeLoans: emprunts.length
        });
      }
      
      // Supprimer l'utilisateur
      db.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({ 
          message: 'Utilisateur supprimé avec succès',
          id: id
        });
      });
    });
  });
});



module.exports = router;