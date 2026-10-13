import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Cefr, PlanLimits } from '../../shared/config'

export type Me = {
  id: string
  email: string
  role: 'user' | 'admin'
  status: 'active' | 'suspended' | 'banned'
  createdAt: number
  profile: {
    displayName: string
    anonName: string
    avatarColor: string
    avatarIcon: string
    birthYear: number | null
    gender: 'female' | 'male' | 'other' | null
    nativeLanguage: string | null
    goal: 'ielts' | 'general' | 'work' | null
    testType: 'academic' | 'general_training' | null
    targetBand: number | null
    dailyMinutes: number | null
    interests: string[]
    cefrLevel: Cefr | null
    cefrScore: number | null
    onboardingStep: 'goals' | 'assessment' | 'interests' | 'done'
    showLevelToPartners: boolean
    showOnLeaderboard: boolean
    remindersEnabled: boolean
    reminderHour: number | null
    aiConsent: boolean
    voiceConsent: boolean
    speechConsent: boolean
    pushEnabled: boolean
  }
  adult: boolean
  plan: {
    planId: string
    planName: string
    limits: PlanLimits
    subscription: { status: string; provider: string; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean } | null
  }
  streak: { current: number; practicedToday: boolean }
  rating: { rating: number; games: number; wins: number }
}

export type AppConfig = {
  appName: string
  features: {
    calls: boolean
    turn: boolean
    speechRecognition: boolean
    wordAudio: boolean
    grammarCheck: boolean
    aiFeedback: boolean
    translation: boolean
    ocr: boolean
    push: boolean
    vapidPublicKey: string | null
    email: boolean
    payments: 'stripe' | 'test' | null
  }
}

/** The signed-in user, or null when logged out. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/me')
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null
        throw e
      }
    },
    staleTime: 30_000,
  })
}

/** Use inside screens that are only rendered for signed-in users. */
export function useUser() {
  const { data } = useMe()
  if (!data) throw new Error('useUser() used outside an authenticated route')
  return data
}

export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: () => api<AppConfig>('/config'), staleTime: 5 * 60_000 })
}

export function useRefreshMe() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['me'] })
}

export const appName = () => import.meta.env.VITE_APP_NAME || 'Bandmate'
