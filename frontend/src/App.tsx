import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PreferencesPage } from './pages/PreferencesPage'
import { TicketsPage } from './pages/TicketsPage'
import { TicketDetailPage } from './pages/TicketDetailPage'
import { SettingsUsersPage } from './pages/settings/SettingsUsersPage'
import { SettingsSlaPage } from './pages/settings/SettingsSlaPage'
import { SettingsEmailPage } from './pages/settings/SettingsEmailPage'
import { SettingsNotificationsPage } from './pages/settings/SettingsNotificationsPage'
import { SettingsTicketsPage } from './pages/settings/SettingsTicketsPage'
import { SettingsTicketCategoriesPage } from './pages/settings/SettingsTicketCategoriesPage'
import { SettingsTicketPropertiesPage } from './pages/settings/SettingsTicketPropertiesPage'
import { SettingsTicketTemplatesPage } from './pages/settings/SettingsTicketTemplatesPage'
import { SettingsCsmPage } from './pages/settings/SettingsCsmPage'
import { SettingsContactsPage } from './pages/settings/SettingsContactsPage'
import { SettingsCompaniesPage } from './pages/settings/SettingsCompaniesPage'
import { SettingsCustomStatusesPage } from './pages/settings/SettingsCustomStatusesPage'
import { SettingsTicketTypesPage } from './pages/settings/SettingsTicketTypesPage'
import { SettingsIntegrationPage } from './pages/settings/SettingsIntegrationPage'
import { SettingsSystemPage } from './pages/settings/SettingsSystemPage'
import { AppLayout } from './components/Layout/AppLayout'
import { RequireAuth } from './components/Layout/RequireAuth'
import { RequireRole } from './components/Layout/RequireRole'
import { SettingsLayout } from './components/Layout/SettingsLayout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/contacts" element={<SettingsContactsPage />} />
            <Route path="/companies" element={<SettingsCompaniesPage />} />
            <Route element={<RequireRole roles={['MasterAdmin', 'Admin']} />}>
              <Route element={<SettingsLayout />}>
                <Route path="/settings" element={<Navigate to="/settings/users" replace />} />
                <Route path="/settings/users" element={<SettingsUsersPage />} />
                <Route path="/settings/sla" element={<SettingsSlaPage />} />
                <Route path="/settings/email" element={<SettingsEmailPage />} />
                <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
                <Route path="/settings/tickets" element={<SettingsTicketsPage />} />
                <Route path="/settings/tickets/categories" element={<SettingsTicketCategoriesPage />} />
                <Route path="/settings/tickets/properties" element={<SettingsTicketPropertiesPage />} />
                <Route path="/settings/tickets/statuses" element={<SettingsCustomStatusesPage />} />
                <Route path="/settings/tickets/types" element={<SettingsTicketTypesPage />} />
                <Route path="/settings/tickets/templates" element={<SettingsTicketTemplatesPage />} />
                <Route path="/settings/csm" element={<SettingsCsmPage />} />
                <Route path="/settings/contacts" element={<Navigate to="/contacts" replace />} />
                <Route path="/settings/companies" element={<Navigate to="/companies" replace />} />
                <Route path="/settings/custom-statuses" element={<Navigate to="/settings/tickets/statuses" replace />} />
                <Route path="/settings/integration" element={<SettingsIntegrationPage />} />
                <Route element={<RequireRole roles={['MasterAdmin']} />}>
                  <Route path="/settings/system" element={<SettingsSystemPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
