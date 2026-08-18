import { AuthClient, TicketClient } from './generated-client'
import { baseURL, httpClient } from './httpClient'

export * from './generated-client'
export { httpClient, baseURL }

export const authClient = new AuthClient(baseURL, httpClient)
export const ticketClient = new TicketClient(baseURL, httpClient)
