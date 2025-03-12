
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Project, Measurement } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Get all projects for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']]
    });
    
    return res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Abrufen der Projekte' });
  }
});

// Get a specific project by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      },
      include: [
        { model: Measurement, as: 'measurements' }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ error: true, message: 'Projekt nicht gefunden' });
    }
    
    return res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Abrufen des Projekts' });
  }
});

// Create a new project
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: true, message: 'Keine Datei hochgeladen' });
    }
    
    // Create the project
    const project = await Project.create({
      name: name || file.originalname.replace(/\.[^/.]+$/, ''),
      userId: req.user.id,
      fileName: file.originalname,
      fileSize: file.size,
      fileUrl: `/uploads/${file.filename}`
    });
    
    return res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Erstellen des Projekts' });
  }
});

// Update project measurements
router.put('/:id/measurements', authMiddleware, async (req, res) => {
  try {
    const { measurements } = req.body;
    
    // Find the project
    const project = await Project.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: true, message: 'Projekt nicht gefunden' });
    }
    
    // Delete existing measurements
    await Measurement.destroy({
      where: { projectId: project.id }
    });
    
    // Create new measurements
    if (Array.isArray(measurements) && measurements.length > 0) {
      const measurementObjects = measurements.map(m => ({
        projectId: project.id,
        type: m.type,
        points: m.points,
        value: m.value,
        unit: m.unit,
        description: m.description
      }));
      
      await Measurement.bulkCreate(measurementObjects);
    }
    
    // Update project updatedAt timestamp
    await project.update({ updatedAt: new Date() });
    
    // Get updated project with measurements
    const updatedProject = await Project.findOne({
      where: { id: project.id },
      include: [
        { model: Measurement, as: 'measurements' }
      ]
    });
    
    return res.json({ project: updatedProject });
  } catch (error) {
    console.error('Update measurements error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Aktualisieren der Messungen' });
  }
});

// Delete a project
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: true, message: 'Projekt nicht gefunden' });
    }
    
    // Delete the associated file
    const filePath = path.join(__dirname, '../..', project.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete the project (cascade will delete measurements)
    await project.destroy();
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ error: true, message: 'Fehler beim Löschen des Projekts' });
  }
});

module.exports = router;
