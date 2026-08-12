import { NextResponse } from "next/server";
import { getSessionUser, requireMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ItemStatus } from "@/generated/prisma/enums";

// 创建备件条目
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: listId } = await params;
  const check = await requireMembership(listId, user.id, true);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "备件名称不能为空" }, { status: 400 });

  // 校验分组属于该清单
  let groupId: string | null = null;
  if (typeof body.groupId === "string" && body.groupId) {
    const group = await prisma.group.findFirst({ where: { id: body.groupId, listId } });
    if (!group) return NextResponse.json({ error: "分组不存在" }, { status: 400 });
    groupId = group.id;
  }

  // 计算组内/清单内排序号
  const lastItem = await prisma.item.findFirst({
    where: { listId, groupId: groupId ?? undefined },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  // 校验负责人属于该清单成员
  let assigneeId: string | null = null;
  if (typeof body.assigneeId === "string" && body.assigneeId) {
    const member = await prisma.listMember.findUnique({
      where: { listId_userId: { listId, userId: body.assigneeId } },
    });
    if (member) assigneeId = member.userId;
  }

  const item = await prisma.item.create({
    data: {
      listId,
      groupId,
      name,
      model: typeof body.model === "string" ? body.model.trim() || null : null,
      qty: typeof body.qty === "number" && body.qty > 0 ? body.qty : 1,
      unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "个",
      assigneeId,
      status: (Object.values(ItemStatus) as string[]).includes(body.status)
        ? (body.status as ItemStatus)
        : "PENDING",
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      sortOrder: lastItem ? lastItem.sortOrder + 1 : 0,
    },
    include: { assignee: { select: { id: true, name: true } }, group: true },
  });

  return NextResponse.json(item, { status: 201 });
}
