
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Register = () => {
  const { isAuthenticated } = useAuth();
  
  // If a user tries to access the register page, redirect them to login instead
  return <Navigate to="/login" />;
};

export default Register;
