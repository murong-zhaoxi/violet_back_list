import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 校验当前用户是否为清单成员，返回 membership（含角色）
async function getMembership(listId: string, userId: string) {
  return prisma.listMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
}

// 获取单个清单详情
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const membership = await getMembership(id, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "无权访问该清单" }, { status: 403 });
  }

  const list = await prisma.list.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      groups: { orderBy: { sortOrder: "asc" } },
      items: {
        include: {
          assignee: { select: { id: true, name: true } },
          group: true,
          _count: { select: { comments: true } },
        },
        orderBy: [{ groupId: "asc" }, { sortOrder: "asc" }],
      },
      _count: { select: { items: true } },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "清单不存在" }, { status: 404 });
  }

  return NextResponse.json({ list, myRole: membership.role });
}

// 更新清单（名称/描述）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const membership = await getMembership(id, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "无权访问该清单" }, { status: 403 });
  }
  if (membership.role === "VIEWER") {
    return NextResponse.json({ error: "只读成员不能修改清单" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; description?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;

  const list = await prisma.list.update({
    where: { id },
    data,
  });

  return NextResponse.json(list);
}

// 删除清单（仅 OWNER）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const membership = await getMembership(id, session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "无权访问该清单" }, { status: 403 });
  }
  if (membership.role !== "OWNER") {
    return NextResponse.json({ error: "只有拥有者可以删除清单" }, { status: 403 });
  }

  await prisma.list.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
