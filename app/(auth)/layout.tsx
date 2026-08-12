export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-blue-50 px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 text-2xl shadow-lg shadow-violet-200">
          📋
        </div>
        <h1 className="text-2xl font-bold text-slate-900">备件计划清单</h1>
        <p className="mt-1 text-sm text-slate-500">团队协作，一起做好每一份清单</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
