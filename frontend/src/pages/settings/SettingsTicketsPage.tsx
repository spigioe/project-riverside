import { useNavigate } from 'react-router-dom'
import shared from '../../components/Settings/SettingsShared.module.css'
import styles from './SettingsTicketsHubPage.module.css'

interface HubCard {
  title: string
  description: string
  to: string
  emoji: string
}

const CARDS: HubCard[] = [
  {
    title: 'Kategóriák',
    description: 'Ticket kategóriák és alkategóriák kezelése',
    to: '/settings/tickets/categories',
    emoji: '🗂',
  },
  {
    title: 'Tulajdonságok',
    description: 'Egyéni mezők és ticket tulajdonságok',
    to: '/settings/tickets/properties',
    emoji: '⚙️',
  },
  {
    title: 'Ticket típusok',
    description: 'Jegy típusok kezelése',
    to: '/settings/tickets/types',
    emoji: '🏷️',
  },
  {
    title: 'Egyéni státuszok',
    description: 'Saját státuszok definiálása',
    to: '/settings/tickets/statuses',
    emoji: '🏷',
  },
  {
    title: 'CSM kezelés',
    description: 'Customer Success Manager hozzárendelések',
    to: '/settings/csm',
    emoji: '👤',
  },
  {
    title: 'Válaszsablonok',
    description: 'Canned response-ok kezelése',
    to: '/settings/tickets/templates',
    emoji: '💬',
  },
]

export function SettingsTicketsPage() {
  const navigate = useNavigate()

  return (
    <div>
      <div className={shared.header}>
        <div>
          <h1 className={shared.title}>Ticket beállítások</h1>
          <div className={shared.subtitle}>Kategóriák, státuszok, tulajdonságok és sablonok kezelése</div>
        </div>
      </div>

      <div className={styles.grid}>
        {CARDS.map((card) => (
          <button
            key={card.to}
            type="button"
            className={styles.card}
            onClick={() => navigate(card.to)}
          >
            <span className={styles.cardEmoji}>{card.emoji}</span>
            <div className={styles.cardBody}>
              <span className={styles.cardTitle}>{card.title}</span>
              <span className={styles.cardDesc}>{card.description}</span>
            </div>
            <span className={styles.cardArrow}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
