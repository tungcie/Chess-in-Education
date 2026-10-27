import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false khi chưa điền .env — app hiện màn hướng dẫn thay vì lỗi trắng trang. */
export const isSupabaseConfigured = !!url && !!anonKey

// TODO(giai đoạn 1, khi có project): sinh kiểu bằng `supabase gen types typescript` → database.types.ts
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
})
