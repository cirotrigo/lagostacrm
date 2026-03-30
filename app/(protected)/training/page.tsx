'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const TrainingPage = dynamic(
    () => import('@/features/ai-training/TrainingPage'),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Página de Treinamento do Agente IA
 */
export default function Training() {
    return <TrainingPage />
}
