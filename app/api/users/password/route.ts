// app/api/users/password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { updateUserPassword } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const role = (session?.user as any)?.role;
    if (!session || (role !== "manager" && role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { login_id, new_password } = body;

    if (!login_id || !new_password) {
      return NextResponse.json(
        { success: false, error: "login_id と new_password は必須です" },
        { status: 400 }
      );
    }

    await updateUserPassword(login_id, new_password);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to change password:", error);
    return NextResponse.json(
      { success: false, error: "パスワード変更に失敗しました" },
      { status: 500 }
    );
  }
}
