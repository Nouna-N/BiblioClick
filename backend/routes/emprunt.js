const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

require('dotenv').config();

// Middleware d'authentification amélioré
const auth = (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    // Format attendu: "Bearer [token]"
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Format de token invalide' });
    }
    
    // Vérifier et décoder le token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ajouter les informations de l'utilisateur décodées à la requête
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.status(401).json({ error: 'Token invalide' });
  }
};

// Route pour emprunter un livre
router.post('/:bookId', auth, async (req, res) => {
    try {
      const bookId = req.params.bookId;
      const userId = req.user.id; // Présume que votre middleware auth place l'ID utilisateur dans req.user.id
      
      // Démarrer une transaction pour garantir l'intégrité des données
      db.beginTransaction(function(err) {
        if (err) { 
          console.error('Erreur lors du démarrage de la transaction:', err);
          return res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
        }
        
        // Vérifier si le livre existe et s'il y a des copies disponibles
        db.query('SELECT id, copies_disponibles FROM books WHERE id = ?', [bookId], function(err, results) {
          if (err) {
            return db.rollback(() => {
              console.error('Erreur lors de la vérification du livre:', err);
              res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
            });
          }
          
          if (results.length === 0) {
            return db.rollback(() => {
              res.status(404).json({ error: 'Livre non trouvé' });
            });
          }
          
          const book = results[0];
          
          if (book.copies_disponibles <= 0) {
            return db.rollback(() => {
              res.status(400).json({ error: 'Ce livre n\'est pas disponible pour l\'emprunt' });
            });
          }
          
          // Vérifier si l'utilisateur a déjà emprunté ce livre et ne l'a pas retourné
          db.query(
            'SELECT id FROM emprunts WHERE utilisateur_id = ? AND livre_id = ? AND status = "en_cours"',
            [userId, bookId],
            function(err, empruntResults) {
              if (err) {
                return db.rollback(() => {
                  console.error('Erreur lors de la vérification des emprunts existants:', err);
                  res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
                });
              }
              
              if (empruntResults.length > 0) {
                return db.rollback(() => {
                  res.status(400).json({ error: 'Vous avez déjà emprunté ce livre' });
                });
              }
              
              // Calculer la date de retour prévue (14 jours après)
              const dateRetourPrevue = new Date();
              dateRetourPrevue.setDate(dateRetourPrevue.getDate() + 14);
              
              // Créer un nouvel emprunt
              const nouvelEmprunt = {
                utilisateur_id: userId,
                livre_id: bookId,
                date_emprunt: new Date(),
                date_retour_prevue: dateRetourPrevue,
                status: 'en_cours'
              };
              
              db.query('INSERT INTO emprunts SET ?', nouvelEmprunt, function(err, empruntResult) {
                if (err) {
                  return db.rollback(() => {
                    console.error('Erreur lors de la création de l\'emprunt:', err);
                    res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
                  });
                }
                
                // Mettre à jour le nombre de copies disponibles du livre
                db.query(
                  'UPDATE books SET copies_disponibles = copies_disponibles - 1 WHERE id = ?',
                  [bookId],
                  function(err, updateResult) {
                    if (err) {
                      return db.rollback(() => {
                        console.error('Erreur lors de la mise à jour des copies disponibles:', err);
                        res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
                      });
                    }
                    
                    // Commit de la transaction
                    db.commit(function(err) {
                      if (err) {
                        return db.rollback(() => {
                          console.error('Erreur lors du commit de la transaction:', err);
                          res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
                        });
                      }
                      
                      res.status(200).json({ 
                        message: 'Livre emprunté avec succès',
                        emprunt: {
                          id: empruntResult.insertId,
                          dateEmprunt: nouvelEmprunt.date_emprunt,
                          dateRetourPrevue: nouvelEmprunt.date_retour_prevue
                        }
                      });
                    });
                  }
                );
              });
            }
          );
        });
      });
      
    } catch (error) {
      console.error('Erreur lors de l\'emprunt du livre:', error);
      res.status(500).json({ error: 'Erreur lors de l\'emprunt du livre' });
    }
  });
  
  // Route pour obtenir tous les emprunts d'un utilisateur
  router.get('/mes-emprunts', auth, (req, res) => {
    try {
      const userId = req.user.id;
      
      db.query(
        `SELECT e.id, e.date_emprunt, e.date_retour_prevue, e.date_retour_effective, e.status,
         l.id as livre_id, l.titre, l.auteur, l.image, l.isbn 
         FROM emprunts e 
         JOIN books l ON e.livre_id = l.id 
         WHERE e.utilisateur_id = ? 
         ORDER BY e.date_emprunt DESC`,
        [userId],
        function(err, results) {
          if (err) {
            console.error('Erreur lors de la récupération des emprunts:', err);
            return res.status(500).json({ error: 'Erreur lors de la récupération des emprunts' });
          }
          
          // Formater les données pour les renvoyer au client
          const emprunts = results.map(emprunt => {
            return {
              id: emprunt.id,
              dateEmprunt: emprunt.date_emprunt,
              dateRetourPrevue: emprunt.date_retour_prevue,
              dateRetourEffective: emprunt.date_retour_effective,
              status: emprunt.status,
              livre: {
                id: emprunt.livre_id,
                titre: emprunt.titre,
                auteur: emprunt.auteur,
                image: emprunt.image,
                isbn: emprunt.isbn
              }
            };
          });
          
          res.status(200).json(emprunts);
        }
      );
    } catch (error) {
      console.error('Erreur lors de la récupération des emprunts:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des emprunts' });
    }
  });
  
  // Route pour retourner un livre
  router.post('/retour/:empruntId', auth, (req, res) => {
    try {
      const empruntId = req.params.empruntId;
      const userId = req.user.id;
      
      // Démarrer une transaction
      db.beginTransaction(function(err) {
        if (err) {
          console.error('Erreur lors du démarrage de la transaction:', err);
          return res.status(500).json({ error: 'Erreur lors du retour du livre' });
        }
        
        // Trouver l'emprunt
        db.query(
          'SELECT id, livre_id FROM emprunts WHERE id = ? AND utilisateur_id = ? AND status = "en_cours"',
          [empruntId, userId],
          function(err, results) {
            if (err) {
              return db.rollback(() => {
                console.error('Erreur lors de la recherche de l\'emprunt:', err);
                res.status(500).json({ error: 'Erreur lors du retour du livre' });
              });
            }
            
            if (results.length === 0) {
              return db.rollback(() => {
                res.status(404).json({ error: 'Emprunt non trouvé ou déjà retourné' });
              });
            }
            
            const emprunt = results[0];
            const bookId = emprunt.livre_id;
            
            // Mettre à jour l'emprunt
            db.query(
              'UPDATE emprunts SET status = "retourné", date_retour_effective = ? WHERE id = ?',
              [new Date(), empruntId],
              function(err, updateResult) {
                if (err) {
                  return db.rollback(() => {
                    console.error('Erreur lors de la mise à jour de l\'emprunt:', err);
                    res.status(500).json({ error: 'Erreur lors du retour du livre' });
                  });
                }
                
                // Mettre à jour le nombre de copies disponibles du livre
                db.query(
                  'UPDATE books SET copies_disponibles = copies_disponibles + 1 WHERE id = ?',
                  [bookId],
                  function(err, updateBookResult) {
                    if (err) {
                      return db.rollback(() => {
                        console.error('Erreur lors de la mise à jour des copies disponibles:', err);
                        res.status(500).json({ error: 'Erreur lors du retour du livre' });
                      });
                    }
                    
                    // Commit de la transaction
                    db.commit(function(err) {
                      if (err) {
                        return db.rollback(() => {
                          console.error('Erreur lors du commit de la transaction:', err);
                          res.status(500).json({ error: 'Erreur lors du retour du livre' });
                        });
                      }
                      
                      res.status(200).json({ 
                        message: 'Livre retourné avec succès',
                        emprunt: {
                          id: empruntId,
                          dateRetour: new Date()
                        }
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
      
    } catch (error) {
      console.error('Erreur lors du retour du livre:', error);
      res.status(500).json({ error: 'Erreur lors du retour du livre' });
    }
  });
  
  module.exports = router;