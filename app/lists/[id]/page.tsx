import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListDetailClient } from "@/components/list-detail-client";
import type { Role } from "@/generated/prisma/enums";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const membership = await prisma.listMember.findUnique({
    where: { listId_userId: { listId: id, userId: session.user.id } },
  });
  if (!membership) redirect("/");

  const list = await prisma.list.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      groups: { orderBy: { sortOrder: "asc" } },
      items: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: "asc" }],
      },
      _count: { select: { items: true } },
    },
  });

  if (!list) redirect("/");

  return (
    <ListDetailClient
      list={list}
      myRole={membership.role as Role}
    />
  );
}
