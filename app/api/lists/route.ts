import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 获取当前用户的清单列表
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const lists = await prisma.list.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { items: true, groups: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(lists);
}

// 新建清单
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "清单名称不能为空" }, { status: 400 });
  }

  const list = await prisma.list.create({
    data: {
      name,
      description: description || null,
      members: {
        create: { userId: session.user.id, role: "OWNER" },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { items: true, groups: true } },
    },
  });

  return NextResponse.json(list, { status: 201 });
}
