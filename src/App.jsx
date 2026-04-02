import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewOrder from './pages/NewOrder'
import OrderDetail from './pages/OrderDetail'
import Users from './pages/Users'
import Profile from './pages/Profile'
import Trash from './pages/Trash'

// 受保护的路由
function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-white text-lg">加载中...</div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" />
  }
  
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" />
  }
  
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
      <Route path="/new" element={
        <PrivateRoute>
          <NewOrder />
        </PrivateRoute>
      } />
      <Route path="/order/:id" element={
        <PrivateRoute>
          <OrderDetail />
        </PrivateRoute>
      } />
      <Route path="/users" element={
        <PrivateRoute adminOnly>
          <Users />
        </PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute>
          <Profile />
        </PrivateRoute>
      } />
      <Route path="/trash" element={
        <PrivateRoute adminOnly>
          <Trash />
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}