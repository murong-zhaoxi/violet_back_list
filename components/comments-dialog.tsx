"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
};

export function CommentsDialog({
  itemId,
  itemName,
  myRole,
  myUserId,
  onClose,
  onCountChange,
}: {
  itemId: string;
  itemName: string;
  myRole: string;
  myUserId: string;
  onClose: () => void;
  onCountChange?: (itemId: string, count: number) => void;
}) {
  const router = useRouter();
  const canEdit = myRole !== "VIEWER";
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
        onCountChange?.(itemId, data.length);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/items/${itemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "发表失败");
        return;
      }
      setComments((prev) => [...prev, data]);
      setContent("");
      onCountChange?.(itemId, comments.length + 1);
      router.refresh();
    } catch {
      setError("发表失败，请稍后重试");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(comment: Comment) {
    if (!confirm("确定删除这条评论吗？")) return;
    const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
    if (res.ok) {
      const next = comments.filter((c) => c.id !== comment.id);
      setComments(next);
      onCountChange?.(itemId, next.length);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "删除失败");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">评论</h3>
            <p className="mt-0.5 text-sm text-slate-500">{itemName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">加载中…</p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">还没有评论，来说两句吧</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-[10px] font-semibold text-white">
                      {c.author.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{c.author.name}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {(c.author.id === myUserId || myRole === "OWNER") && (
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-xs text-slate-400 transition hover:text-red-500"
                    >
                      删除
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{c.content}</p>
              </div>
            ))
          )}
        </div>

        {canEdit && (
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下你的评论…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "…" : "发表"}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
