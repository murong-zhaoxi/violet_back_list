import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function loadGroupAndCheck(groupId: string, userId: string, canEdit: boolean) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { list: { include: { members: true } } },
  });
  if (!group) return { error: "分组不存在", status: 404 as const };
  const membership = group.list.members.find((m) => m.userId === userId);
  if (!membership) return { error: "无权访问该清单", status: 403 as const };
  if (canEdit && membership.role === "VIEWER")
    return { error: "只读成员不能修改清单", status: 403 as const };
  return { group };
}

// 重命名分组
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadGroupAndCheck(id, user.id, true);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "分组名称不能为空" }, { status: 400 });

  const group = await prisma.group.update({ where: { id }, data: { name } });
  return NextResponse.json(group);
}

// 删除分组（组内备件保留，解除分组）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadGroupAndCheck(id, user.id, true);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  await prisma.$transaction([
    prisma.item.updateMany({ where: { groupId: id }, data: { groupId: null } }),
    prisma.group.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
