
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: true, message: 'E-Mail oder Passwort falsch' });
    }
    
    // Check password
    const isPasswordValid = await user.checkPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: true, message: 'E-Mail oder Passwort falsch' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );
    
    // Return user data and token
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: true, message: 'Anmeldefehler. Bitte versuchen Sie es später erneut.' });
  }
});

// Register route (admin only)
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { email, password, isAdmin } = req.body;
    
    // Check if request user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: true, message: 'Nur Administratoren können neue Benutzer anlegen' });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: true, message: 'Diese E-Mail wird bereits verwendet' });
    }
    
    // Create user
    const user = await User.create({
      email,
      password,
      isAdmin: isAdmin || false
    });
    
    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: true, message: 'Fehler bei der Registrierung' });
  }
});

// Get current user route
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'isAdmin', 'createdAt']
    });
    
    if (!user) {
      return res.status(404).json({ error: true, message: 'Benutzer nicht gefunden' });
    }
    
    return res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Abrufen des Benutzers' });
  }
});

module.exports = router;
