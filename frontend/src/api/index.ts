import { AuthClient, TicketClient, UsersClient, NotificationsClient } from './generated-client'
import { baseURL, httpClient } from './httpClient'

export * from './generated-client'
export { httpClient, baseURL }

export const authClient = new AuthClient(baseURL, httpClient)
export const ticketClient = new TicketClient(baseURL, httpClient)
export const usersClient = new UsersClient(baseURL, httpClient)
export const notificationsClient = new NotificationsClient(baseURL, httpClient)
