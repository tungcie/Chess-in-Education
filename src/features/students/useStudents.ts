import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createStudent,
  deleteGuardian,
  deleteStudent,
  getStudent,
  listGuardians,
  listLinkedAccounts,
  listStudentClasses,
  listStudents,
  saveGuardian,
  setStudentStatus,
  unlinkAccount,
  updateStudent,
  type GuardianInput,
  type StudentInput,
} from './studentsApi'
import type { StudentStatus } from './studentRules'

export const studentsKey = (orgId: string) => [orgId, 'students'] as const

export function useStudentList(orgId: string) {
  return useQuery({ queryKey: studentsKey(orgId), queryFn: () => listStudents(orgId) })
}

export function useStudent(orgId: string, id: string) {
  return useQuery({ queryKey: [...studentsKey(orgId), id], queryFn: () => getStudent(id) })
}

export function useGuardians(orgId: string, studentId: string) {
  return useQuery({ queryKey: [...studentsKey(orgId), studentId, 'guardians'], queryFn: () => listGuardians(studentId) })
}

export function useLinkedAccounts(orgId: string, studentId: string) {
  return useQuery({ queryKey: [...studentsKey(orgId), studentId, 'accounts'], queryFn: () => listLinkedAccounts(studentId) })
}

export function useStudentClasses(orgId: string, studentId: string) {
  return useQuery({ queryKey: [orgId, 'classes', 'student', studentId], queryFn: () => listStudentClasses(studentId) })
}

/** Mọi thao tác ghi hồ sơ: xong thì tải lại toàn bộ dữ liệu học viên của đơn vị. */
export function useStudentMutations(orgId: string) {
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: studentsKey(orgId) })
  return {
    create: useMutation({
      mutationFn: (v: { input: StudentInput; guardian: GuardianInput | null }) => createStudent(orgId, v.input, v.guardian),
      onSuccess,
    }),
    update: useMutation({ mutationFn: (v: { id: string; input: StudentInput }) => updateStudent(v.id, v.input), onSuccess }),
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: StudentStatus }) => setStudentStatus(v.id, v.status),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteStudent(id), onSuccess }),
    saveGuardian: useMutation({
      mutationFn: (v: { studentId: string; input: GuardianInput & { is_primary: boolean }; id?: string }) =>
        saveGuardian(orgId, v.studentId, v.input, v.id),
      onSuccess,
    }),
    deleteGuardian: useMutation({ mutationFn: (id: string) => deleteGuardian(id), onSuccess }),
    unlink: useMutation({ mutationFn: (linkId: string) => unlinkAccount(linkId), onSuccess }),
  }
}
