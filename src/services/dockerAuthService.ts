
import axios from 'axios';

// API base URL
const API_URL = '/api/auth';

// Define user interface
export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

// Set up axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

// Add auth token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login user
export const loginWithDocker = async (
  email: string, 
  password: string
): Promise<{ user: User; token: string } | null> => {
  try {
    const response = await api.post('/login', { email, password });
    const { user, token } = response.data;
    
    // Store token in localStorage
    localStorage.setItem('authToken', token);
    
    return { user, token };
  } catch (error: any) {
    console.error("Login error:", error.response?.data?.message || error.message);
    throw new Error(error.response?.data?.message || "Die Anmeldung ist fehlgeschlagen");
  }
};

// Logout user
export const logoutFromDocker = async (): Promise<boolean> => {
  try {
    // Remove token from localStorage
    localStorage.removeItem('authToken');
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await api.get('/me');
    return response.data.user;
  } catch (error) {
    console.error("Get current user error:", error);
    localStorage.removeItem('authToken');
    return null;
  }
};

// Create new user (admin only)
export const createUserInDocker = async (
  email: string,
  password: string,
  isAdmin: boolean
): Promise<User | null> => {
  try {
    const response = await api.post('/register', { email, password, isAdmin });
    return response.data.user;
  } catch (error: any) {
    console.error("Create user error:", error.response?.data?.message || error.message);
    throw new Error(error.response?.data?.message || "Benutzer konnte nicht erstellt werden");
  }
};

// Get all users (admin only)
export const getAllUsersFromDocker = async (): Promise<User[]> => {
  try {
    const response = await axios.get('/api/users', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    return response.data.users;
  } catch (error) {
    console.error("Get all users error:", error);
    return [];
  }
};

// Delete user (admin only)
export const deleteUserFromDocker = async (userId: string): Promise<boolean> => {
  try {
    await axios.delete(`/api/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    return true;
  } catch (error) {
    console.error("Delete user error:", error);
    return false;
  }
};

// Update user (admin only)
export const updateUserInDocker = async (
  userId: string,
  updates: { email?: string; password?: string; isAdmin?: boolean }
): Promise<User | null> => {
  try {
    const response = await axios.put(`/api/users/${userId}`, updates, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    return response.data.user;
  } catch (error) {
    console.error("Update user error:", error);
    return null;
  }
};
