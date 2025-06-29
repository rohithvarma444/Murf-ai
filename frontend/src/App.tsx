import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import CreateProject from './pages/CreateProject'
import ProjectDetails from './pages/ProjectDetails'
import PublicChat from './pages/PublicChat'
import CustomerCare from './pages/CustomerCare'
import DubbingStudio from './pages/DubbingStudio'
import { api } from './lib/api'

const App: React.FC = () => {
  const { user, token, setToken } = useAuthStore()

  useEffect(() => {
    // Set API token on mount if available
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }, [token])

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/login" />} />
      <Route path="/chat/:projectId" element={<PublicChat />} />
      <Route path="/care/:projectId" element={<CustomerCare />} />
      
      {/* Protected routes with Layout */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      <Route path="/dashboard" element={user ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} />
      <Route path="/create-project" element={user ? <Layout><CreateProject /></Layout> : <Navigate to="/login" />} />
      <Route path="/projects/:id" element={user ? <Layout><ProjectDetails /></Layout> : <Navigate to="/login" />} />
      <Route path="/dubbing-studio" element={user ? <Layout><DubbingStudio /></Layout> : <Navigate to="/login" />} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default App 