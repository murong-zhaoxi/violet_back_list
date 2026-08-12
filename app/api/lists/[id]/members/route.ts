import { NextResponse } from "next/server";
import { getSessionUser, getMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

// 添加成员（仅 OWNER），通过邮箱查找用户
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: listId } = await params;
  const membership = await getMembership(listId, user.id);
  if (!membership) return NextResponse.json({ error: "无权访问该清单" }, { status: 403 });
  if (membership.role !== "OWNER") {
    return NextResponse.json({ error: "只有拥有者可以管理成员" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email) return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return NextResponse.json({ error: "未找到该邮箱对应的用户" }, { status: 404 });

  const existing = await prisma.listMember.findUnique({
    where: { listId_userId: { listId, userId: target.id } },
  });
  if (existing) return NextResponse.json({ error: "该用户已是清单成员" }, { status: 409 });

  const role: Role = body.role === "VIEWER" || body.role === "EDITOR" ? (body.role as Role) : "EDITOR";

  const member = await prisma.listMember.create({
    data: { listId, userId: target.id, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(member, { status: 201 });
}
