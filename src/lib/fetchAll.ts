// Supabase trả tối đa 1.000 dòng mỗi lần và CẮT IM LẶNG (CLAUDE.md mục 12).
// Bảng lớn dần phải đọc qua fetchAll; truy vấn truyền vào phải có .order() theo cột duy nhất.

export const PAGE_SIZE = 1000
export const IN_CHUNK_SIZE = 150

type PageResult<T> = { data: T[] | null; error: unknown }

/**
 * Đọc hết các trang. `page(from, to)` phải trả về truy vấn đã `.order(...)` và `.range(from, to)`.
 * Ví dụ: fetchAll((from, to) => supabase.from('org_members').select('*').eq('org_id', id).order('id').range(from, to))
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return rows
  }
}

/** Chia danh sách id dài thành từng lô cho `.in()` (URL quá dài sẽ lỗi). */
export function chunk<T>(items: readonly T[], size = IN_CHUNK_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
