import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt="头像"
              className="h-11 w-11 rounded-full object-cover ring-2 ring-violet-100"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-base font-bold text-white">
              {(user?.name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900 md:text-2xl">
              你好，{user?.name || "朋友"} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">这里是您的备件计划清单</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            账户管理
          </Link>
          <LogoutButton />
        </div>
      </header>

      <DashboardClient initialLists={lists} />
    </div>
  );
}
