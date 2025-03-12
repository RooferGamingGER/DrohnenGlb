
import axios from 'axios';
import { Measurement } from '@/utils/measurementUtils';

// Define project interface
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  thumbnail?: string;
  measurements: Measurement[];
}

// API base URL - can be configured based on environment
const API_URL = '/api';

// Set up axios instance with auth token handling
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Save a new project
export const saveProject = async (
  file: File, 
  measurements: Measurement[] = []
): Promise<Project | null> => {
  try {
    // Prepare clean measurements without 3D objects to avoid circular references
    const cleanMeasurements = measurements.map(m => ({
      ...m,
      labelObject: undefined,
      lineObjects: undefined,
      pointObjects: undefined,
      areaObject: undefined
    }));

    // Create form data for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

    // Upload the file
    const response = await api.post('/projects', formData);
    const project = response.data.project;

    // If there are measurements, update them
    if (cleanMeasurements.length > 0) {
      await api.put(`/projects/${project.id}/measurements`, {
        measurements: cleanMeasurements
      });
    }

    return project;
  } catch (error) {
    console.error("Error saving project:", error);
    return null;
  }
};

// Get all projects for the current user
export const getUserProjects = async (): Promise<Project[]> => {
  try {
    const response = await api.get('/projects');
    return response.data.projects;
  } catch (error) {
    console.error("Error getting user projects:", error);
    return [];
  }
};

// Get a specific project by ID
export const getProjectById = async (projectId: string): Promise<Project | null> => {
  try {
    const response = await api.get(`/projects/${projectId}`);
    return response.data.project;
  } catch (error) {
    console.error("Error getting project:", error);
    return null;
  }
};

// Update project measurements
export const updateProjectMeasurements = async (
  projectId: string, 
  measurements: Measurement[]
): Promise<boolean> => {
  try {
    // Clean measurements to remove 3D objects before storing
    const cleanMeasurements = measurements.map(m => ({
      ...m,
      labelObject: undefined,
      lineObjects: undefined,
      pointObjects: undefined,
      areaObject: undefined
    }));
    
    await api.put(`/projects/${projectId}/measurements`, {
      measurements: cleanMeasurements
    });
    
    return true;
  } catch (error) {
    console.error("Error updating measurements:", error);
    return false;
  }
};

// Delete a project
export const deleteProject = async (projectId: string): Promise<boolean> => {
  try {
    await api.delete(`/projects/${projectId}`);
    return true;
  } catch (error) {
    console.error("Error deleting project:", error);
    return false;
  }
};
