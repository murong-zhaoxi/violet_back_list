import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountSettings } from "@/components/account-settings";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
      _count: { select: { memberships: true, comments: true } },
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-10">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="transition hover:text-violet-600">
          首页
        </Link>
        <span>/</span>
        <span className="text-slate-700">账户管理</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">账户管理</h1>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          返回首页
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">管理您的头像、基本资料和账户</p>

      <div className="mt-6">
        <AccountSettings
          initialUser={{
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt,
            listCount: user._count.memberships,
            commentCount: user._count.comments,
          }}
        />
      </div>
    </div>
  );
}
