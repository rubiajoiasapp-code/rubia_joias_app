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
import ExpirationDates from './pages/ExpirationDates';
import Catalog from './pages/Catalog';
import Historico from './pages/Historico';

// Desabilita autenticação apenas em desenvolvimento local e se a variável
// VITE_DISABLE_AUTH=true estiver presente — nunca em produção.
const DISABLE_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DISABLE_AUTH === 'true';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<Login />} />
          <Route path="/catalogo" element={<Catalog />} />

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
            <Route path="historico" element={<Historico />} />
            <Route path="vencimentos" element={<ExpirationDates />} />
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
