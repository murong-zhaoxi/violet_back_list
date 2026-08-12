import { NextResponse } from "next/server";
import { getSessionUser, getMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ItemStatus } from "@/generated/prisma/enums";

const STATUS_LABEL: Record<ItemStatus, string> = {
  PENDING: "待采购",
  ORDERED: "已采购",
  RECEIVED: "已到位",
  DONE: "已完成",
  CANCELLED: "已取消",
};

// 导出清单为 Excel (.xlsx)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: listId } = await params;
  const membership = await getMembership(listId, user.id);
  if (!membership) return NextResponse.json({ error: "无权访问该清单" }, { status: 403 });

  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: {
      groups: { orderBy: { sortOrder: "asc" } },
      items: {
        include: { assignee: { select: { name: true } }, group: true },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });
  if (!list) return NextResponse.json({ error: "清单不存在" }, { status: 404 });

  // 计算编号
  const sortedGroups = [...list.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const groupIndex = (groupId: string | null) => {
    if (!groupId) return sortedGroups.length + 1;
    const idx = sortedGroups.findIndex((g) => g.id === groupId);
    return idx === -1 ? sortedGroups.length + 1 : idx + 1;
  };
  const itemIndexInGroup: Record<string, number> = {};
  const rows = list.items.map((item) => {
    const key = item.groupId ?? "__none__";
    itemIndexInGroup[key] = (itemIndexInGroup[key] ?? 0) + 1;
    return {
      编号: `${groupIndex(item.groupId)}.${itemIndexInGroup[key]}`,
      分组: item.group?.name ?? "未分组",
      名称: item.name,
      型号规格: item.model ?? "",
      数量: item.qty,
      单位: item.unit,
      负责人: item.assignee?.name ?? "",
      状态: STATUS_LABEL[item.status],
      备注: item.notes ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  // 设置列宽
  ws["!cols"] = [
    { wch: 8 }, { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 8 }, { wch: 8 },
    { wch: 12 }, { wch: 10 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "备件清单");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `${list.name}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
