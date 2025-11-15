import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // middleware ロジックはここに書く（オプション）
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // 認証が不要なパスを除外
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
