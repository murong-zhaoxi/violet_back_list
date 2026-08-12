import { NextResponse } from "next/server";
import { getSessionUser, requireMembership } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// 创建分组（子清单）
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
  if (!name) return NextResponse.json({ error: "分组名称不能为空" }, { status: 400 });

  // 计算新的排序号
  const count = await prisma.group.count({ where: { listId } });
  const group = await prisma.group.create({
    data: { listId, name, sortOrder: count },
  });

  return NextResponse.json(group, { status: 201 });
}
