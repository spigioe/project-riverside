import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  ticketId?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const MAX_VISIBLE_TOASTS = 3

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }].slice(-MAX_VISIBLE_TOASTS),
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
