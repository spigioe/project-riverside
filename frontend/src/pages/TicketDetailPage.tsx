import { useParams } from 'react-router-dom'

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div>
      <h1>Jegy #{id}</h1>
      <p>Ez az oldal még nincs implementálva.</p>
    </div>
  )
}
