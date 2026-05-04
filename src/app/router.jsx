import { createBrowserRouter } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import SubscriptionRoute from '../components/SubscriptionRoute'
import LandingPage from '../pages/LandingPage'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Dashboard from '../pages/Dashboard'
import Clients from '../pages/Clients'
import Charges from '../pages/Charges'
import Automations from '../pages/Automations'
import Settings from '../pages/Settings'
import Plans from '../pages/Plans'
import Privacidade from '../pages/Privacidade'
import Termos from '../pages/Termos'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/cadastro',
    element: <Register />,
  },
  {
    path: '/privacidade',
    element: <Privacidade />,
  },
  {
    path: '/termos',
    element: <Termos />,
  },
  {
    path: '/planos',
    element: (
      <ProtectedRoute>
        <Plans />
      </ProtectedRoute>
    ),
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <SubscriptionRoute>
          <AppLayout />
        </SubscriptionRoute>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'clientes', element: <Clients /> },
      { path: 'cobrancas', element: <Charges /> },
      { path: 'automacoes', element: <Automations /> },
      { path: 'configuracoes', element: <Settings /> },
    ],
  },
])