import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 头像最大 2MB
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// 获取当前用户资料
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, avatar: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// 更新资料（头像 / 名字 / 邮箱）
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; email?: string; avatar?: string | null } = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
    }
    data.name = name;
  }

  if ("email" in body) {
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }
    if (email !== session.user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json({ error: "该邮箱已被使用" }, { status: 409 });
      }
    }
    data.email = email;
  }

  if ("avatar" in body) {
    const avatar = body.avatar;
    if (avatar === null || avatar === "") {
      data.avatar = null;
    } else if (typeof avatar === "string") {
      if (!avatar.startsWith("data:image/")) {
        return NextResponse.json({ error: "头像格式不正确" }, { status: 400 });
      }
      const byteLength = Math.ceil((avatar.length - avatar.indexOf(",") - 1) * 0.75);
      if (byteLength > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "头像图片不能超过 2MB" }, { status: 400 });
      }
      data.avatar = avatar;
    } else {
      return NextResponse.json({ error: "头像格式不正确" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有需要更新的内容" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, avatar: true, createdAt: true },
  });

  return NextResponse.json(user);
}

// 注销账户
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // 先删除该用户作为 OWNER 的清单（连同清单下的数据一起级联删除）
  const ownedLists = await prisma.list.findMany({
    where: { members: { some: { userId, role: "OWNER" } } },
    select: { id: true },
  });

  await prisma.$transaction([
    ...ownedLists.map((list) => prisma.list.delete({ where: { id: list.id } })),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
