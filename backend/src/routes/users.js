
const express = require('express');
const { User } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if request user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: true, message: 'Nur Administratoren können alle Benutzer anzeigen' });
    }
    
    const users = await User.findAll({
      attributes: ['id', 'email', 'isAdmin', 'createdAt', 'updatedAt']
    });
    
    return res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Abrufen der Benutzer' });
  }
});

// Delete a user (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if request user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: true, message: 'Nur Administratoren können Benutzer löschen' });
    }
    
    // Prevent deleting yourself
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: true, message: 'Sie können Ihr eigenes Konto nicht löschen' });
    }
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: true, message: 'Benutzer nicht gefunden' });
    }
    
    await user.destroy();
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Löschen des Benutzers' });
  }
});

// Update a user (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { email, password, isAdmin } = req.body;
    
    // Check if request user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: true, message: 'Nur Administratoren können Benutzer bearbeiten' });
    }
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: true, message: 'Benutzer nicht gefunden' });
    }
    
    // Update fields
    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (isAdmin !== undefined) updates.isAdmin = isAdmin;
    
    await user.update(updates);
    
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Aktualisieren des Benutzers' });
  }
});

module.exports = router;
