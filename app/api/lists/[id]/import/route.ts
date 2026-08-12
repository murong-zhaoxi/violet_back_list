import { NextResponse } from "next/server";
import { getSessionUser, requireMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ItemStatus } from "@/generated/prisma/enums";

const STATUS_TO_ENUM: Record<string, ItemStatus> = {
  待采购: "PENDING",
  已采购: "ORDERED",
  已到位: "RECEIVED",
  已完成: "DONE",
  已取消: "CANCELLED",
  PENDING: "PENDING",
  ORDERED: "ORDERED",
  RECEIVED: "RECEIVED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
};

// 批量导入备件
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

  const body = await request.json().catch(() => []);
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "数据格式不正确" }, { status: 400 });
  }
  const rows = body.filter((r) => r && typeof r === "object");
  if (rows.length === 0) {
    return NextResponse.json({ error: "没有可导入的数据" }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: "单次最多导入 2000 条" }, { status: 400 });
  }

  // 预取现有数据
  const [groups, members] = await Promise.all([
    prisma.group.findMany({ where: { listId } }),
    prisma.listMember.findMany({
      where: { listId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // 分组名 -> id（自动创建缺失分组）
  const groupByName = new Map<string, string>();
  let nextGroupOrder = groups.length;
  for (const g of groups) groupByName.set(g.name, g.id);

  // 负责人名 -> userId
  const userByName = new Map<string, string>();
  for (const m of members) {
    userByName.set(m.user.name, m.user.id);
    userByName.set(m.user.email, m.user.id);
  }

  const created: { name: string; groupId: string | null }[] = [];
  let groupOrder = nextGroupOrder;

  for (const row of rows) {
    const name = String(row.name ?? row["名称"] ?? "").trim();
    if (!name) continue;

    // 分组
    let groupId: string | null = null;
    const groupName = String(row.group ?? row["分组"] ?? "").trim();
    if (groupName) {
      let gid = groupByName.get(groupName);
      if (!gid) {
        const g = await prisma.group.create({
          data: { listId, name: groupName, sortOrder: groupOrder++ },
        });
        gid = g.id;
        groupByName.set(groupName, gid);
      }
      groupId = gid;
    }

    const model = String(row.model ?? row["型号规格"] ?? row["型号"] ?? "").trim() || null;
    const qty = Number(row.qty ?? row["数量"] ?? 1) || 1;
    const unit = String(row.unit ?? row["单位"] ?? "个").trim() || "个";
    const notes = String(row.notes ?? row["备注"] ?? "").trim() || null;

    let status: ItemStatus = "PENDING";
    const statusRaw = String(row.status ?? row["状态"] ?? "").trim();
    if (STATUS_TO_ENUM[statusRaw]) status = STATUS_TO_ENUM[statusRaw];

    const assigneeName = String(row.assignee ?? row["负责人"] ?? "").trim();
    const assigneeId = assigneeName ? userByName.get(assigneeName) ?? null : null;

    const item = await prisma.item.create({
      data: {
        listId,
        groupId,
        name,
        model,
        qty,
        unit,
        notes,
        status,
        assigneeId,
        sortOrder: 0,
      },
      select: { id: true, name: true },
    });
    created.push({ name: item.name, groupId });
  }

  return NextResponse.json({ count: created.length, items: created }, { status: 201 });
}
