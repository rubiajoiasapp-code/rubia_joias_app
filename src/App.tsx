import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Financial from './pages/Financial';
import Inventory from './pages/Inventory';
import Clients from './pages/Clients';
import Credit from './pages/Credit';
import Settings from './pages/Settings';

// TEMPORÁRIO: Desabilitar autenticação para desenvolvimento
const DISABLE_AUTH = false;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              DISABLE_AUTH ? <Layout /> : (
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              )
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="vendas" element={<Sales />} />
            <Route path="financeiro" element={<Financial />} />
            <Route path="crediario" element={<Credit />} />
            <Route path="estoque" element={<Inventory />} />
            <Route path="configuracoes" element={<Settings />} />
          </Route>

          {/* Redirect any unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
