export default function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">{title}</span>
        {Icon ? <Icon className="h-5 w-5 text-slate-500" /> : null}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}