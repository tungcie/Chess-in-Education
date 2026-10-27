import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getClass,
  getMeeting,
  listAttendance,
  listClasses,
  listMeetingAttendance,
  listMeetings,
  listMeetingsBetween,
  listMembers,
  listTeacherOptions,
} from './classesApi'

export const classesKey = (orgId: string) => [orgId, 'classes'] as const

export function useClassList(orgId: string) {
  return useQuery({ queryKey: [...classesKey(orgId), 'list'], queryFn: () => listClasses(orgId) })
}

export function useClass(orgId: string, id: string) {
  return useQuery({ queryKey: [...classesKey(orgId), id], queryFn: () => getClass(id) })
}

export function useClassMeetings(orgId: string, classId: string) {
  return useQuery({ queryKey: [...classesKey(orgId), classId, 'meetings'], queryFn: () => listMeetings(classId) })
}

export function useClassMembers(orgId: string, classId: string) {
  return useQuery({ queryKey: [...classesKey(orgId), classId, 'members'], queryFn: () => listMembers(classId) })
}

export function useClassAttendance(orgId: string, classId: string) {
  return useQuery({ queryKey: [...classesKey(orgId), classId, 'attendance'], queryFn: () => listAttendance(classId) })
}

export function useMeeting(orgId: string, meetingId: string) {
  return useQuery({ queryKey: [...classesKey(orgId), 'meeting', meetingId], queryFn: () => getMeeting(meetingId) })
}

export function useMeetingAttendance(orgId: string, meetingId: string) {
  return useQuery({
    queryKey: [...classesKey(orgId), 'meeting', meetingId, 'attendance'],
    queryFn: () => listMeetingAttendance(meetingId),
  })
}

export function useMeetingsBetween(orgId: string, from: string, to: string) {
  return useQuery({ queryKey: [...classesKey(orgId), 'range', from, to], queryFn: () => listMeetingsBetween(orgId, from, to) })
}

export function useTeacherOptions(orgId: string) {
  return useQuery({ queryKey: [orgId, 'teacher-options'], queryFn: () => listTeacherOptions(orgId), staleTime: 5 * 60_000 })
}

/** Ghi xong → tải lại mọi dữ liệu lớp / buổi / điểm danh / học phí của đơn vị. */
export function useInvalidateClasses(orgId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: classesKey(orgId) })
    void qc.invalidateQueries({ queryKey: [orgId, 'tuition'] })
    void qc.invalidateQueries({ queryKey: [orgId, 'students'] })
  }
}
