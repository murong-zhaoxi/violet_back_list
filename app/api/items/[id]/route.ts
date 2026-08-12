import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ItemStatus } from "@/generated/prisma/enums";

async function loadItemAndCheck(itemId: string, userId: string, canEdit: boolean) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { list: { include: { members: true } } },
  });
  if (!item) return { error: "备件不存在", status: 404 as const };
  const membership = item.list.members.find((m) => m.userId === userId);
  if (!membership) return { error: "无权访问该清单", status: 403 as const };
  if (canEdit && membership.role === "VIEWER")
    return { error: "只读成员不能修改清单", status: 403 as const };
  return { item };
}

// 更新备件
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadItemAndCheck(id, user.id, true);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { item } = check;

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "备件名称不能为空" }, { status: 400 });
    data.name = name;
  }
  if (typeof body.model === "string") data.model = body.model.trim() || null;
  if (typeof body.qty === "number" && body.qty > 0) data.qty = body.qty;
  if (typeof body.unit === "string") data.unit = body.unit.trim() || "个";
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.status === "string" && (Object.values(ItemStatus) as string[]).includes(body.status)) {
    data.status = body.status as ItemStatus;
  }
  // 负责人
  if (body.assigneeId !== undefined) {
    if (body.assigneeId === null || body.assigneeId === "") {
      data.assigneeId = null;
    } else if (typeof body.assigneeId === "string") {
      const member = await prisma.listMember.findUnique({
        where: { listId_userId: { listId: item.listId, userId: body.assigneeId } },
      });
      data.assigneeId = member ? member.userId : null;
    }
  }
  // 分组
  if (body.groupId !== undefined) {
    if (body.groupId === null || body.groupId === "") {
      data.groupId = null;
    } else if (typeof body.groupId === "string") {
      const group = await prisma.group.findFirst({
        where: { id: body.groupId, listId: item.listId },
      });
      if (!group) return NextResponse.json({ error: "分组不存在" }, { status: 400 });
      data.groupId = group.id;
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data,
    include: { assignee: { select: { id: true, name: true } }, group: true },
  });

  return NextResponse.json(updated);
}

// 删除备件
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadItemAndCheck(id, user.id, true);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
