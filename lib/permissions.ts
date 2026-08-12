import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = { id: string; name?: string | null; email?: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function getMembership(listId: string, userId: string) {
  return prisma.listMember.findUnique({
    where: { listId_userId: { listId, userId } },
  });
}

// 校验成员身份并返回角色；可选 canEdit 控制只读成员被拒
export async function requireMembership(listId: string, userId: string, canEdit = false) {
  const membership = await getMembership(listId, userId);
  if (!membership) return { error: "无权访问该清单", status: 403 as const };
  if (canEdit && membership.role === "VIEWER")
    return { error: "只读成员不能修改清单", status: 403 as const };
  return { membership: membership as { id: string; listId: string; userId: string; role: Role } };
}
