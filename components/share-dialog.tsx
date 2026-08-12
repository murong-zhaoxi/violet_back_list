"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";

type Member = { id: string; role: Role; user: { id: string; name: string; email: string } };

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "拥有者",
  EDITOR: "可编辑",
  VIEWER: "只读",
};

export function ShareDialog({
  listId,
  members: initialMembers,
  myRole,
  onClose,
}: {
  listId: string;
  members: Member[];
  myRole: Role;
  onClose: () => void;
}) {
  const router = useRouter();
  const isOwner = myRole === "OWNER";
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "添加失败");
        return;
      }
      setMembers((prev) => [...prev, data]);
      setEmail("");
      router.refresh();
    } catch {
      setError("添加失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: Role) {
    const res = await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      const data = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === memberId ? data : m)));
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "修改角色失败");
    }
  }

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`确定将「${name}」移出清单吗？`)) return;
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "移除失败");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">共享清单</h3>
            <p className="mt-1 text-sm text-slate-500">邀请团队成员一起协作</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {isOwner && (
          <form onSubmit={handleAdd} className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="对方邮箱"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="EDITOR">可编辑</option>
                <option value="VIEWER">只读</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? "添加中…" : "添加成员"}
            </button>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </form>
        )}

        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium text-slate-400">成员列表（{members.length}）</p>
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-sm font-semibold text-white">
                  {m.user.name.slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.user.name}</p>
                  <p className="text-xs text-slate-400">{m.user.email}</p>
                </div>
              </div>
              {isOwner ? (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                    className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:outline-none"
                  >
                    <option value="OWNER">拥有者</option>
                    <option value="EDITOR">可编辑</option>
                    <option value="VIEWER">只读</option>
                  </select>
                  <button
                    onClick={() => handleRemove(m.id, m.user.name)}
                    className="text-xs text-slate-400 transition hover:text-red-500"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
