import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export default async function Home() {
    // Após um reset do banco, a instância ainda não está inicializada.
    // Nessa fase, a página inicial deve levar o usuário para o setup.
    try {
        const supabase = await createClient()
        const { data, error } = await supabase.rpc('is_instance_initialized')
        if (!error && data === false) {
            redirect('/setup')
        }
    } catch {
        // Se houver qualquer problema ao checar init, não bloqueia.
    }

    redirect('/dashboard')
}
