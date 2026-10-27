import { describe, expect, it } from 'vitest'
import { chunk, fetchAll } from './fetchAll'

describe('fetchAll', () => {
  it('đọc hết các trang, không dừng ở trang đầy', async () => {
    const source = Array.from({ length: 2500 }, (_, i) => i)
    const calls: Array<[number, number]> = []
    const rows = await fetchAll(async (from, to) => {
      calls.push([from, to])
      return { data: source.slice(from, to + 1), error: null }
    })
    expect(rows).toHaveLength(2500)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('trang cuối vừa đúng đầy thì đọc thêm 1 trang rỗng rồi dừng', async () => {
    const source = Array.from({ length: 4 }, (_, i) => i)
    let n = 0
    const rows = await fetchAll(async (from, to) => {
      n++
      return { data: source.slice(from, to + 1), error: null }
    }, 2)
    expect(rows).toEqual([0, 1, 2, 3])
    expect(n).toBe(3)
  })

  it('báo lỗi thay vì trả thiếu dữ liệu', async () => {
    await expect(fetchAll(async () => ({ data: null, error: new Error('hỏng') }))).rejects.toThrow('hỏng')
  })
})

describe('chunk', () => {
  it('chia lô 150', () => {
    const parts = chunk(Array.from({ length: 301 }, (_, i) => i))
    expect(parts.map((p) => p.length)).toEqual([150, 150, 1])
    expect(chunk([])).toEqual([])
  })
})
