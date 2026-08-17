"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import * as XLSX from "xlsx";
import type { Role, ItemStatus } from "@/generated/prisma/enums";
import { ShareDialog } from "@/components/share-dialog";
import { CommentsDialog } from "@/components/comments-dialog";

type Item = {
  id: string;
  name: string;
  model: string | null;
  qty: number;
  unit: string;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  status: ItemStatus;
  notes: string | null;
  groupId: string | null;
  sortOrder: number;
  _count?: { comments: number };
};

type Group = { id: string; name: string; sortOrder: number };
type Member = { id: string; role: Role; user: { id: string; name: string; email: string } };

type ListData = {
  id: string;
  name: string;
  description: string | null;
  members: Member[];
  groups: Group[];
  items: Item[];
  _count: { items: number };
};

const STATUS_META: Record<ItemStatus, { label: string; cls: string }> = {
  PENDING: { label: "待采购", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ORDERED: { label: "已采购", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  RECEIVED: { label: "已到位", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  DONE: { label: "已完成", cls: "bg-green-50 text-green-700 border-green-200" },
  CANCELLED: { label: "已取消", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const STATUS_ORDER: ItemStatus[] = ["PENDING", "ORDERED", "RECEIVED", "DONE", "CANCELLED"];

type FormState = {
  name: string;
  model: string;
  qty: string;
  unit: string;
  assigneeId: string;
  status: ItemStatus;
  notes: string;
  groupId: string;
};

const emptyForm: FormState = {
  name: "",
  model: "",
  qty: "1",
  unit: "个",
  assigneeId: "",
  status: "PENDING",
  notes: "",
  groupId: "",
};

export function ListDetailClient({
  list: initialList,
  myRole,
  myUserId,
}: {
  list: ListData;
  myRole: Role;
  myUserId: string;
}) {
  const router = useRouter();
  const canEdit = myRole !== "VIEWER";

  const [list, setList] = useState<ListData>(initialList);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [activeCommentItem, setActiveCommentItem] = useState<Item | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 准实时刷新：每 20 秒轮询服务端，同步他人修改
  const { data: remoteData, mutate: refreshData } = useSWR(
    `/api/lists/${list.id}`,
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 20000 }
  );

  useEffect(() => {
    if (remoteData?.list && !showForm && !activeCommentItem && !showShare) {
      setList(remoteData.list);
      setLastSync(new Date());
    }
  }, [remoteData, showForm, activeCommentItem, showShare]);

  async function handleManualRefresh() {
    try {
      const res = await fetch(`/api/lists/${list.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.list) {
          setList(data.list);
          setLastSync(new Date());
        }
      }
    } catch {
      // 忽略刷新失败
    }
  }

  function handleExport() {
    const a = document.createElement("a");
    a.href = `/api/lists/${list.id}/export`;
    a.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const payload = rows.map((r) => ({
        name: r["名称"] ?? r["name"],
        model: r["型号规格"] ?? r["型号"] ?? r["model"],
        qty: r["数量"] ?? r["qty"],
        unit: r["单位"] ?? r["unit"],
        assignee: r["负责人"] ?? r["assignee"],
        status: r["状态"] ?? r["status"],
        notes: r["备注"] ?? r["notes"],
        group: r["分组"] ?? r["group"],
      }));
      if (payload.length === 0) {
        setImportMsg("文件中没有可导入的数据");
        return;
      }
      const res = await fetch(`/api/lists/${list.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg(data.error || "导入失败");
        return;
      }
      setImportMsg(`✅ 成功导入 ${data.count} 条备件`);
      router.refresh();
    } catch {
      setImportMsg("导入失败，请检查文件格式（支持 .xlsx / .csv）");
    } finally {
      setImporting(false);
    }
  }

  function updateCommentCount(itemId: string, count: number) {
    setList((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.id === itemId ? { ...i, _count: { comments: count } } : i
      ),
    }));
  }

  // 按分组排序后的组列表 + 计算编号
  const sortedGroups = [...list.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const groupIndex = (groupId: string | null) => {
    if (!groupId) return sortedGroups.length + 1; // 未分组放最后
    const idx = sortedGroups.findIndex((g) => g.id === groupId);
    return idx === -1 ? sortedGroups.length + 1 : idx + 1;
  };
  const itemsOfGroup = (groupId: string | null) =>
    [...list.items]
      .filter((i) => (groupId ? i.groupId === groupId : !i.groupId))
      .sort((a, b) => a.sortOrder - b.sortOrder);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(item: Item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      model: item.model || "",
      qty: String(item.qty),
      unit: item.unit,
      assigneeId: item.assigneeId || "",
      status: item.status,
      notes: item.notes || "",
      groupId: item.groupId || "",
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        model: form.model,
        qty: Number(form.qty) || 1,
        unit: form.unit,
        assigneeId: form.assigneeId || null,
        status: form.status,
        notes: form.notes,
        groupId: form.groupId || null,
      };
      const url = editingId ? `/api/items/${editingId}` : `/api/lists/${list.id}/items`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      if (editingId) {
        setList((prev) => ({
          ...prev,
          items: prev.items.map((i) => (i.id === editingId ? data : i)),
        }));
      } else {
        setList((prev) => ({ ...prev, items: [...prev.items, data] }));
      }
      setShowForm(false);
      router.refresh();
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(item: Item) {
    if (!confirm(`确定删除备件「${item.name}」吗？`)) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setList((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== item.id) }));
      router.refresh();
    } else {
      alert("删除失败");
    }
  }

  async function handleQuickStatus(item: Item, status: ItemStatus) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === item.id ? data : i)),
      }));
      router.refresh();
    }
  }

  async function handleAddGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const res = await fetch(`/api/lists/${list.id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const group = await res.json();
      setList((prev) => ({ ...prev, groups: [...prev.groups, group] }));
      setNewGroupName("");
      router.refresh();
    } else {
      alert("创建分组失败");
    }
  }

  async function handleRenameGroup(groupId: string) {
    const name = renameValue.trim();
    if (!name) {
      setRenamingGroupId(null);
      return;
    }
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const group = await res.json();
      setList((prev) => ({
        ...prev,
        groups: prev.groups.map((g) => (g.id === groupId ? group : g)),
      }));
      setRenamingGroupId(null);
      router.refresh();
    }
  }

  async function handleDeleteGroup(group: Group) {
    if (!confirm(`删除分组「${group.name}」？组内备件会移到未分组。`)) return;
    const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
    if (res.ok) {
      setList((prev) => ({
        ...prev,
        groups: prev.groups.filter((g) => g.id !== group.id),
        items: prev.items.map((i) =>
          i.groupId === group.id ? { ...i, groupId: null, group: null } : i
        ),
      }));
      router.refresh();
    } else {
      alert("删除分组失败");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200";

  function renderTable(groupId: string | null) {
    const items = itemsOfGroup(groupId);
    const gIdx = groupIndex(groupId);
    if (items.length === 0) {
      return (
        <p className="px-4 py-6 text-center text-sm text-slate-400">暂无备件</p>
      );
    }
    return (
      <>
        {/* 桌面端表格 */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-400">
                <th className="px-4 py-2 font-medium w-14">编号</th>
                <th className="px-4 py-2 font-medium">名称</th>
                <th className="px-4 py-2 font-medium">型号/规格</th>
                <th className="px-4 py-2 font-medium w-24">数量</th>
                <th className="px-4 py-2 font-medium w-28">负责人</th>
                <th className="px-4 py-2 font-medium w-28">状态</th>
                <th className="px-4 py-2 font-medium w-20">评论</th>
                {canEdit && <th className="px-4 py-2 font-medium w-28 text-right">操作</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const meta = STATUS_META[item.status];
                return (
                  <tr key={item.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {gIdx}.{idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.notes && (
                        <div className="mt-0.5 max-w-xs truncate text-xs text-slate-400" title={item.notes}>
                          📝 {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.model || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.qty} {item.unit}
                    </td>
                    <td className="px-4 py-3">
                      {item.assignee ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[10px] font-semibold text-white">
                            {item.assignee.name.slice(0, 1)}
                          </span>
                          <span className="text-slate-600">{item.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <select
                          value={item.status}
                          onChange={(e) => handleQuickStatus(item, e.target.value as ItemStatus)}
                          className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium ${meta.cls} focus:outline-none`}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-block rounded-md border px-2 py-1 text-xs font-medium ${meta.cls}`}>
                          {meta.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setActiveCommentItem(item)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-violet-50 hover:text-violet-600"
                        title="查看/发表评论"
                      >
                        💬 {item._count?.comments ?? 0}
                      </button>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-slate-400 transition hover:text-violet-600"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="text-slate-400 transition hover:text-red-500"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 移动端卡片列表 */}
        <div className="divide-y divide-slate-100 md:hidden">
          {items.map((item, idx) => {
            const meta = STATUS_META[item.status];
            return (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-xs text-slate-400">
                        {gIdx}.{idx + 1}
                      </span>
                      <span className="truncate font-medium text-slate-900">{item.name}</span>
                    </div>
                    {item.model && (
                      <div className="mt-0.5 pl-6 text-xs text-slate-500">型号：{item.model}</div>
                    )}
                    {item.notes && (
                      <div className="mt-0.5 pl-6 text-xs text-slate-400">📝 {item.notes}</div>
                    )}
                  </div>
                  {canEdit ? (
                    <select
                      value={item.status}
                      onChange={(e) => handleQuickStatus(item, e.target.value as ItemStatus)}
                      className={`shrink-0 cursor-pointer rounded-md border px-1.5 py-0.5 text-xs font-medium ${meta.cls} focus:outline-none`}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0">
                      {item.qty} {item.unit}
                    </span>
                    <span className="truncate">
                      {item.assignee ? `👤 ${item.assignee.name}` : "未指派"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => setActiveCommentItem(item)}
                      className="text-slate-500 transition hover:text-violet-600"
                    >
                      💬 {item._count?.comments ?? 0}
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => openEdit(item)}
                          className="text-slate-400 transition hover:text-violet-600"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="text-slate-400 transition hover:text-red-500"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      {/* 顶部 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Link
            href="/"
            className="text-sm text-slate-400 transition hover:text-violet-600"
          >
            ← 返回仪表盘
          </Link>
          <h1 className="mt-2 text-xl font-bold text-slate-900 md:text-2xl">{list.name}</h1>
          {list.description && (
            <p className="mt-1 text-sm text-slate-500">{list.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {list.members.map((m) => (
                <span
                  key={m.id}
                  title={m.user.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-semibold text-white ring-2 ring-white"
                >
                  {m.user.name.slice(0, 1)}
                </span>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              {list.members.length} 人协作 · {list._count.items} 项备件 ·{" "}
              {myRole === "OWNER" ? "拥有者" : myRole === "EDITOR" ? "可编辑" : "只读"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <button
            onClick={() => setShowShare(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
          >
            👥 共享
          </button>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="mt-6 flex flex-wrap items-center gap-2 md:mt-8">
        {canEdit && (
          <>
            <button
              onClick={openCreate}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-700 md:px-4 md:py-2"
            >
              + 添加备件
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-60 md:px-4 md:py-2"
            >
              {importing ? "导入中…" : "⬆ 导入"}
            </button>
            <div className="flex items-center gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                placeholder="新建分组…"
                className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 md:w-36 md:py-2"
              />
              <button
                onClick={handleAddGroup}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 md:px-3 md:py-2"
              >
                新建分组
              </button>
            </div>
          </>
        )}
        <button
          onClick={handleExport}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-violet-700 md:px-4 md:py-2"
        >
          ⬇ 导出
        </button>
        <button
          onClick={handleManualRefresh}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:text-violet-700 md:px-4 md:py-2"
          title="立即刷新，获取他人最新修改"
        >
          ⟳ 刷新
        </button>
        <span className="text-xs text-slate-400">
          {lastSync ? `已同步 ${lastSync.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "每 20 秒自动同步"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".xlsx,.xls,.csv"
          onChange={handleImportFile}
        />
        {importMsg && (
          <span className="text-sm font-medium text-slate-600">{importMsg}</span>
        )}
      </div>

      {/* 分组与备件 */}
      <div className="mt-6 space-y-6">
        {sortedGroups.map((group, gIdx) => (
          <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              {renamingGroupId === group.id ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-400">{gIdx + 1}</span>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameGroup(group.id);
                      if (e.key === "Escape") setRenamingGroupId(null);
                    }}
                    autoFocus
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => handleRenameGroup(group.id)}
                    className="text-sm text-violet-600"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-violet-600">{gIdx + 1}</span>
                  <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
                  <span className="text-xs text-slate-400">
                    {itemsOfGroup(group.id).length} 项
                  </span>
                </div>
              )}
              {canEdit && (
                <div className="flex shrink-0 gap-2 text-xs">
                  {renamingGroupId !== group.id && (
                    <button
                      onClick={() => {
                        setRenamingGroupId(group.id);
                        setRenameValue(group.name);
                      }}
                      className="text-slate-400 transition hover:text-violet-600"
                    >
                      重命名
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    className="text-slate-400 transition hover:text-red-500"
                  >
                    删除分组
                  </button>
                </div>
              )}
            </header>
            {renderTable(group.id)}
          </section>
        ))}

        {/* 未分组（仅当存在未分组备件时显示，避免空占位无法删除） */}
        {itemsOfGroup(null).length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-slate-500">
                  {sortedGroups.length + 1}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">未分组</h3>
                <span className="text-xs text-slate-400">{itemsOfGroup(null).length} 项</span>
              </div>
            </header>
            {renderTable(null)}
          </section>
        )}
      </div>

      {/* 添加/编辑备件弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingId ? "编辑备件" : "添加备件"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">填写备件计划信息</p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">名称 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例如：轴承 6205"
                    required
                    autoFocus
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">型号/规格</label>
                  <input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="例如：6205-2RS"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">所属分组</label>
                  <select
                    value={form.groupId}
                    onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">未分组</option>
                    {sortedGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">需求数量</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.qty}
                    onChange={(e) => setForm({ ...form, qty: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">单位</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="个/套/件"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">负责人</label>
                  <select
                    value={form.assigneeId}
                    onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">未指定</option>
                    {list.members.map((m) => (
                      <option key={m.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">状态</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ItemStatus })}
                    className={inputCls}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">备注</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    placeholder="补充说明"
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showShare && (
        <ShareDialog
          listId={list.id}
          members={list.members}
          myRole={myRole}
          onClose={() => setShowShare(false)}
        />
      )}

      {activeCommentItem && (
        <CommentsDialog
          itemId={activeCommentItem.id}
          itemName={activeCommentItem.name}
          myRole={myRole}
          myUserId={myUserId}
          onClose={() => setActiveCommentItem(null)}
          onCountChange={updateCommentCount}
        />
      )}
    </div>
  );
}
