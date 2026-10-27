/** Lỗi Supabase Auth (tiếng Anh) → câu tiếng Việt cho người dùng. */
export function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Sai email / tên đăng nhập hoặc mật khẩu'
  if (/email not confirmed/i.test(message)) return 'Tài khoản chưa được xác nhận email'
  if (/rate limit|too many/i.test(message)) return 'Thử quá nhiều lần, hãy đợi vài phút rồi thử lại'
  if (/failed to fetch|network/i.test(message)) return 'Không kết nối được máy chủ, kiểm tra mạng rồi thử lại'
  return message
}
