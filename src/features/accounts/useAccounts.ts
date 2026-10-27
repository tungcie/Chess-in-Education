import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { callAdminUsers, listMembers } from './accountsApi'

export const membersKey = (orgId: string) => [orgId, 'members'] as const

export function useMembers(orgId: string) {
  return useQuery({ queryKey: membersKey(orgId), queryFn: () => listMembers(orgId) })
}

/** Mọi thao tác tài khoản đi qua Edge Function; xong thì tải lại danh sách. */
export function useAdminUsers(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof callAdminUsers>[1]) => callAdminUsers(orgId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: membersKey(orgId) }),
  })
}
