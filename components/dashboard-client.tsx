"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ListWithMeta = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: Date | string;
  members: { user: { id: string; name: string } }[];
  _count: { items: number; groups: number };
};

export function DashboardClient({ initialLists }: { initialLists: ListWithMeta[] }) {
  const router = useRouter();
  const [lists, setLists] = useState<ListWithMeta[]>(initialLists);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
        return;
      }
      setLists((prev) => [data, ...prev]);
      setShowCreate(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("创建失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除这份清单吗？该操作不可恢复。")) return;
    const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLists((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "删除失败");
    }
  }

  return (
    <main className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">我的清单</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          + 新建清单
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-14 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-sm font-medium text-slate-700">还没有清单</p>
          <p className="mt-1 text-sm text-slate-400">创建第一份备件计划清单，开始协作吧</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <div
              key={list.id}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow-md"
            >
              <Link href={`/lists/${list.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-violet-700">
                    {list.name}
                  </h3>
                </div>
                {list.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{list.description}</p>
                )}
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                  <span>📦 {list._count.items} 项备件</span>
                  <span>👥 {list.members.length} 人协作</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {list.members.slice(0, 4).map((m) => (
                      <span
                        key={m.user.id}
                        title={m.user.name}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[10px] font-semibold text-white ring-2 ring-white"
                      >
                        {m.user.name.slice(0, 1)}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(list.updatedAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
                <button
                  onClick={() => handleDelete(list.id)}
                  className="text-xs text-slate-400 transition hover:text-red-500"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">新建清单</h3>
            <p className="mt-1 text-sm text-slate-500">创建一份备件计划清单</p>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">清单名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：3号产线检修备件"
                  required
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">描述（可选）</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简单说明这份清单的用途"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {loading ? "创建中…" : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
