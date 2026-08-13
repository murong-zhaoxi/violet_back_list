import Link from "next/link";

export default function RegisterSuccessPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-4xl">
        ✅
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-900">注册成功！</h2>
      <p className="mt-2 text-sm text-slate-500">
        您的账号已创建完成，现在可以登录开始协作管理备件计划清单了。
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
      >
        去登录
      </Link>
      <p className="mt-4 text-xs text-slate-400">提示：登录后即可创建和共享备件计划清单</p>
    </div>
  );
}
