import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { App } from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import { NotConfiguredPage } from './features/auth/Gates'
import { queryClient } from './lib/queryClient'
import { isSupabaseConfigured } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <NotConfiguredPage />
    )}
  </StrictMode>,
)
