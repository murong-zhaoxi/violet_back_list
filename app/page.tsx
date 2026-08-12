import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { DashboardClient } from "@/components/dashboard-client";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  const lists = await prisma.list.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { items: true, groups: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            你好，{user?.name || "朋友"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">这里是您的备件计划清单</p>
        </div>
        <LogoutButton />
      </header>

      <DashboardClient initialLists={lists} />
    </div>
  );
}
