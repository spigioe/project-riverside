import {
  ApiKeysClient,
  AuditLogClient,
  AuthClient,
  CannedResponsesClient,
  CategoriesClient,
  CsmClient,
  DashboardClient,
  IntegrationClient,
  MeClient,
  NotificationsClient,
  RolesClient,
  SettingsClient,
  SlaClient,
  TicketAiClient,
  TicketClient,
  UsersClient,
} from './generated-client'
import { baseURL, httpClient } from './httpClient'

export * from './generated-client'
export { httpClient, baseURL }

export const authClient = new AuthClient(baseURL, httpClient)
export const ticketClient = new TicketClient(baseURL, httpClient)
export const ticketAiClient = new TicketAiClient(baseURL, httpClient)
export const usersClient = new UsersClient(baseURL, httpClient)
export const notificationsClient = new NotificationsClient(baseURL, httpClient)
export const rolesClient = new RolesClient(baseURL, httpClient)
export const slaClient = new SlaClient(baseURL, httpClient)
export const settingsClient = new SettingsClient(baseURL, httpClient)
export const categoriesClient = new CategoriesClient(baseURL, httpClient)
export const cannedResponsesClient = new CannedResponsesClient(baseURL, httpClient)
export const integrationClient = new IntegrationClient(baseURL, httpClient)
export const apiKeysClient = new ApiKeysClient(baseURL, httpClient)
export const auditLogClient = new AuditLogClient(baseURL, httpClient)
export const csmClient = new CsmClient(baseURL, httpClient)
export const dashboardClient = new DashboardClient(baseURL, httpClient)
export const meClient = new MeClient(baseURL, httpClient)
