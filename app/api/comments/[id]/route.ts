import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// 删除评论（仅作者本人或清单拥有者）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { item: { include: { list: { include: { members: true } } } } },
  });
  if (!comment) return NextResponse.json({ error: "评论不存在" }, { status: 404 });

  const isAuthor = comment.authorId === user.id;
  const membership = comment.item.list.members.find((m) => m.userId === user.id);
  const isOwner = membership?.role === "OWNER";
  if (!isAuthor && !isOwner) {
    return NextResponse.json({ error: "无权删除该评论" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
