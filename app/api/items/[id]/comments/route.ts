import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function loadItemAndCheck(itemId: string, userId: string, canEdit: boolean) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { list: { include: { members: true } } },
  });
  if (!item) return { error: "备件不存在", status: 404 as const };
  const membership = item.list.members.find((m) => m.userId === userId);
  if (!membership) return { error: "无权访问该清单", status: 403 as const };
  if (canEdit && membership.role === "VIEWER")
    return { error: "只读成员不能发表评论", status: 403 as const };
  return { item };
}

// 获取评论列表
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const check = await loadItemAndCheck(id, user.id, false);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const comments = await prisma.comment.findMany({
    where: { itemId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

// 添加评论
export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: { itemId: id, authorId: user.id, content },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
