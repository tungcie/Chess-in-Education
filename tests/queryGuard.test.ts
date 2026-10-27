// Chặn bẫy "Supabase cắt im lặng ở 1.000 dòng" (CLAUDE.md mục 12): mọi lệnh ĐỌC bảng lớn dần phải có
// .range( (qua fetchAll) / .single( / .maybeSingle( / .limit(. Lệnh ghi (insert / update / delete / upsert) không bị kiểm.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Bảng / view lớn dần. Thêm bảng mới vào đây khi tạo. */
const GROWING = [
  'org_members',
  'profiles',
  'students',
  'student_profiles',
  'student_names',
  'guardians',
  'account_students',
  'classes',
  'class_schedule_slots',
  'class_teachers',
  'class_members',
  'class_meetings',
  'class_attendance',
  'tuition_packages',
  'tuition_payments',
  'audit_log',
]

const BOUNDED = /\.(range|single|maybeSingle|limit)\(/
const WRITE = /^\s*\.(insert|update|delete|upsert)\(/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

/** Lấy chuỗi lệnh sau .from('bảng') tới hết biểu thức (dòng trống, dấu ; hoặc 600 ký tự). */
function chainAfter(source: string, index: number): string {
  const rest = source.slice(index, index + 600)
  const end = rest.search(/\n\s*\n|;/)
  return end === -1 ? rest : rest.slice(0, end)
}

describe('truy vấn bảng lớn không bị cắt ở 1.000 dòng', () => {
  it('mọi lệnh đọc bảng lớn đều có giới hạn / phân trang', () => {
    const problems: string[] = []
    for (const file of sourceFiles('src')) {
      const source = readFileSync(file, 'utf8')
      const re = new RegExp(`\\.from\\('(${GROWING.join('|')})'\\)`, 'g')
      for (const match of source.matchAll(re)) {
        const after = chainAfter(source, match.index! + match[0].length)
        if (WRITE.test(after)) continue
        if (!BOUNDED.test(after)) {
          const line = source.slice(0, match.index).split('\n').length
          problems.push(`${file}:${line} — .from('${match[1]}') thiếu .range/.single/.maybeSingle/.limit (dùng fetchAll)`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})
