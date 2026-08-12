import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

async function loadMemberAndCheck(memberId: string, userId: string) {
  const member = await prisma.listMember.findUnique({
    where: { id: memberId },
    include: { list: { include: { members: true } } },
  });
  if (!member) return { error: "成员不存在", status: 404 as const };
  const me = member.list.members.find((m) => m.userId === userId);
  if (!me) return { error: "无权访问该清单", status: 403 as const };
  if (me.role !== "OWNER") {
    return { error: "只有拥有者可以管理成员", status: 403 as const };
  }
  return { member };
}

// 修改成员角色（仅 OWNER）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadMemberAndCheck(id, user.id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { member } = check;

  const body = await request.json().catch(() => ({}));
  const role = body.role as Role;
  if (!["OWNER", "EDITOR", "VIEWER"].includes(role)) {
    return NextResponse.json({ error: "无效的角色" }, { status: 400 });
  }

  // 防止最后一名 OWNER 被降级
  if (member.role === "OWNER" && role !== "OWNER") {
    const ownerCount = member.list.members.filter((m) => m.role === "OWNER").length;
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "清单至少需要一名拥有者" }, { status: 400 });
    }
  }

  const updated = await prisma.listMember.update({
    where: { id },
    data: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(updated);
}

// 移除成员（仅 OWNER，不能移除自己）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadMemberAndCheck(id, user.id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { member } = check;

  if (member.userId === user.id) {
    return NextResponse.json({ error: "不能移除自己，如需转移所有权请先更换角色" }, { status: 400 });
  }

  await prisma.listMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
