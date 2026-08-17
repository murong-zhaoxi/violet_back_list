"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Toast, type ToastType } from "@/components/toast";

type AccountUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: Date | string;
  listCount: number;
  commentCount: number;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-slate-50 disabled:text-slate-400";

export function AccountSettings({ initialUser }: { initialUser: AccountUser }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name);
  const [email, setEmail] = useState(initialUser.email);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // 注销相关
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function applyProfile(patch: Record<string, unknown>) {
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "保存失败，请稍后重试");
    }
    setUser(data);
    router.refresh();
    return data;
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const patch: Record<string, unknown> = {};
      if (name.trim() !== user.name) patch.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) patch.email = email.trim();
      if (Object.keys(patch).length === 0) {
        setSaved(true);
        return;
      }
      await applyProfile(patch);
      setSaved(true);
      setToast({ type: "success", message: "资料已保存" });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "保存失败，请稍后重试",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", message: "请选择图片文件" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ type: "error", message: "头像图片不能超过 2MB" });
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
      });
      await applyProfile({ avatar: dataUrl });
      setToast({ type: "success", message: "头像已更新" });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "头像上传失败，请稍后重试",
      });
    }
  }

  async function handleRemoveAvatar() {
    try {
      await applyProfile({ avatar: null });
      setToast({ type: "success", message: "头像已移除" });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "操作失败，请稍后重试",
      });
    }
  }

  async function handleDeleteAccount() {
    if (confirmText.trim() !== user.email) {
      setToast({ type: "error", message: "请输入您的邮箱以确认注销" });
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "注销失败，请稍后重试");
      }
      setShowDeleteModal(false);
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "注销失败，请稍后重试",
      });
      setDeleting(false);
    }
  }

  const avatarUrl = user.avatar || "";

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="space-y-6">
        {/* 头像 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">头像</h2>
          <p className="mt-1 text-sm text-slate-500">支持 JPG、PNG 等图片格式，大小不超过 2MB</p>

          <div className="mt-5 flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="头像"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-violet-100"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-2xl font-bold text-white ring-2 ring-violet-100">
                  {(user.name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                更换头像
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  移除头像
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>
        </section>

        {/* 基本资料 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">基本资料</h2>
          <p className="mt-1 text-sm text-slate-500">更新您的姓名和登录邮箱</p>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                姓名
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaved(false);
                }}
                className={inputCls}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                修改邮箱后，下次登录请使用新邮箱
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中…" : "保存修改"}
              </button>
              {saved && <span className="text-sm text-emerald-600">✓ 已保存</span>}
            </div>
          </form>
        </section>

        {/* 账户概览 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">账户概览</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-slate-500">加入时间</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {new Date(user.createdAt).toLocaleDateString("zh-CN")}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-slate-500">参与的清单</dt>
              <dd className="mt-1 font-medium text-slate-900">{user.listCount} 份</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-slate-500">发表的评论</dt>
              <dd className="mt-1 font-medium text-slate-900">{user.commentCount} 条</dd>
            </div>
          </dl>
        </section>

        {/* 危险区：注销账户 */}
        <section className="rounded-2xl border border-red-200 bg-red-50/50 p-6">
          <h2 className="text-base font-semibold text-red-700">危险操作</h2>
          <p className="mt-1 text-sm text-red-600/80">
            注销账户将永久删除您的账号及相关数据，该操作不可恢复。
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            注销账户
          </button>
        </section>
      </div>

      {/* 注销确认弹窗 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-red-600">确定要注销账户吗？</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              注销后，您的账号、您创建的清单以及相关数据将被永久删除，且无法恢复。请谨慎操作。
            </p>
            <p className="mt-3 text-sm text-slate-600">
              请输入您的邮箱{" "}
              <span className="font-semibold text-slate-900">{user.email}</span> 以确认注销：
            </p>
            <input
              type="email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              autoFocus
              className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText("");
                }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "注销中…" : "确认注销"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
