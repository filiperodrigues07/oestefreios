import { createBrowserRouter } from 'react-router';
import { DashboardPlaceholderPage } from '../pages/DashboardPlaceholderPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { ProtectedRoute } from './ProtectedRoute.js';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPlaceholderPage />
      </ProtectedRoute>
    ),
  },
]);
