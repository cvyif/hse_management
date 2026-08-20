import { createBrowserRouter, Navigate } from 'react-router-dom'

import {
  ApprovedGuard,
  AuthGuard,
  GuestGuard,
  RequirePermission,
} from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { RejectedPage, RegisterPendingPage } from '@/features/auth/RegisterStatusPages'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ForbiddenPage, NotFoundPage } from '@/features/error/ErrorPages'
import { AppShell } from '@/features/layout/AppShell'
import { RegistrationsPage } from '@/features/admin/RegistrationsPage'
import { UsersPage } from '@/features/admin/UsersPage'
import { CompaniesPage } from '@/features/admin/CompaniesPage'
import { AreasPage } from '@/features/admin/AreasPage'
import { RotationsPage } from '@/features/admin/RotationsPage'
import { AssignmentsPage } from '@/features/admin/AssignmentsPage'
import { ObservationListPage } from '@/features/observations/ObservationListPage'
import { NewObservationPage } from '@/features/observations/NewObservationPage'
import { ObservationDetailPage } from '@/features/observations/ObservationDetailPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { SiteMapPage } from '@/features/map/SiteMapPage'
import { AreaPositionEditor } from '@/features/map/AreaPositionEditor'

export const router = createBrowserRouter([
  { path: '/login', element: <GuestGuard><LoginPage /></GuestGuard> },
  { path: '/register', element: <GuestGuard><RegisterPage /></GuestGuard> },
  { path: '/register-pending', element: <AuthGuard><RegisterPendingPage /></AuthGuard> },
  { path: '/rejected', element: <AuthGuard><RejectedPage /></AuthGuard> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <ApprovedGuard>
          <AppShell />
        </ApprovedGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'observations',
        element: (
          <RequirePermission permission="observation:read">
            <ObservationListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'map',
        element: (
          <RequirePermission permission="observation:read">
            <SiteMapPage />
          </RequirePermission>
        ),
      },
      {
        path: 'observations/new',
        element: (
          <RequirePermission permission="observation:create">
            <NewObservationPage />
          </RequirePermission>
        ),
      },
      {
        path: 'observations/:id',
        element: (
          <RequirePermission permission="observation:read">
            <ObservationDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequirePermission permission="user:manage">
            <Navigate to="/admin/registrations" replace />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/registrations',
        element: (
          <RequirePermission permission="registration:manage">
            <RegistrationsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RequirePermission permission="user:manage">
            <UsersPage />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/companies',
        element: (
          <RequirePermission permission="company:manage">
            <CompaniesPage />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/areas',
        element: (
          <RequirePermission permission="area:manage">
            <AreasPage />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/areas/:id/map',
        element: (
          <RequirePermission permission="area:manage">
            <AreaPositionEditor />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/rotations',
        element: (
          <RequirePermission permission="rotation:manage">
            <RotationsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'admin/assignments',
        element: (
          <RequirePermission permission="areaAuthority:manage">
            <AssignmentsPage />
          </RequirePermission>
        ),
      },
      { path: '403', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])