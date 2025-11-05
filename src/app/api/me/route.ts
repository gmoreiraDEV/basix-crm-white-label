import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export async function GET(req: Request) {
  const cookie = (req as any).cookies?.get?.("token")?.value || null;
  // Edge runtimes don't expose cookies in req; use headers
  const cookieHeader = (req as any).headers?.get?.("cookie") as string | null;
  const token = cookie || (cookieHeader ? (cookieHeader.split('; ').find(s => s.startsWith('token=')) || '').split('=')[1] : null);

  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  return NextResponse.json({ email: payload.email });
}
