import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: { include: { list: true }, orderBy: { createdAt: "desc" } } },
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

      <main className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">我的清单</h2>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">
            + 新建清单
          </button>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-14 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-sm font-medium text-slate-700">还没有清单</p>
          <p className="mt-1 text-sm text-slate-400">创建第一份备件计划清单，开始协作吧</p>
        </div>
      </main>
    </div>
  );
}
