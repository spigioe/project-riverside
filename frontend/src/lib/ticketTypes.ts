import { useQuery } from '@tanstack/react-query'
import { ticketTypesClient } from '../api'

export function useTicketTypes() {
  return useQuery({
    queryKey: ['ticket-types'],
    queryFn: () => ticketTypesClient.getAll(),
    staleTime: 60_000,
  })
}
