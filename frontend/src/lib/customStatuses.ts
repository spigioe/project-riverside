import { useQuery } from '@tanstack/react-query'
import { customStatusesClient, CustomStatusDto } from '../api'
import {
  faCircleDot, faClock, faCircleCheck, faLock, faInbox,
  faHourglass, faWrench, faBan, faArrowRight, faStar,
  faPhone, faComment, faFire, faCircleQuestion,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export const CUSTOM_STATUS_ICONS: Record<string, IconDefinition> = {
  'circle-dot':      faCircleDot,
  'clock':           faClock,
  'circle-check':    faCircleCheck,
  'lock':            faLock,
  'inbox':           faInbox,
  'hourglass':       faHourglass,
  'wrench':          faWrench,
  'ban':             faBan,
  'arrow-right':     faArrowRight,
  'star':            faStar,
  'phone':           faPhone,
  'comment':         faComment,
  'fire':            faFire,
  'circle-question': faCircleQuestion,
}

export const CUSTOM_STATUS_EMOJI: Record<string, string> = {
  'circle-dot':      '●',
  'clock':           '⏰',
  'circle-check':    '✅',
  'lock':            '🔒',
  'inbox':           '📥',
  'hourglass':       '⏳',
  'wrench':          '🔧',
  'ban':             '🚫',
  'arrow-right':     '→',
  'star':            '⭐',
  'phone':           '📞',
  'comment':         '💬',
  'fire':            '🔥',
  'circle-question': '❓',
}

// badge CSS class name suffix → badge module class
export const CUSTOM_STATUS_BADGE_CLASSES: Record<string, string> = {
  gray:    'gray',
  primary: 'primary',
  amber:   'amber',
  green:   'green',
  dark:    'dark',
  purple:  'purple',
  red:     'red',
}

export function useCustomStatuses() {
  return useQuery({
    queryKey: ['custom-statuses'],
    queryFn: () => customStatusesClient.getAll(),
    staleTime: 60_000,
  })
}

export function findCustomStatus(statuses: CustomStatusDto[], key: string | null | undefined): CustomStatusDto | undefined {
  if (!key) return undefined
  return statuses.find((s) => s.key === key && s.isActive)
}
