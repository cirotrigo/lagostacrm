'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const ReservationsPage = dynamic(
  () => import('@/features/reservations/ReservationsPage'),
  { loading: () => <PageLoader />, ssr: false }
)

export default function Reservations() {
  return <ReservationsPage />
}
