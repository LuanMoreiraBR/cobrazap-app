export function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

export function isInsidePeriod(dateValue, period, referenceDate) {
  if (!dateValue || !referenceDate) return false

  const dateKey = String(dateValue).slice(0, 10)
  const referenceKey = String(referenceDate).slice(0, 10)

  if (period === 'day') {
    return dateKey === referenceKey
  }

  if (period === 'month') {
    return dateKey.slice(0, 7) === referenceKey.slice(0, 7)
  }

  if (period === 'year') {
    return dateKey.slice(0, 4) === referenceKey.slice(0, 4)
  }

  return true
}

export default function PeriodFilter({
  period,
  setPeriod,
  referenceDate,
  setReferenceDate,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-[#070D2D]">
          Filtro de período
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Visualize informações do dia, mês ou ano selecionado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input"
        >
          <option value="day">Dia</option>
          <option value="month">Mês</option>
          <option value="year">Ano</option>
        </select>

        {period === 'day' ? (
          <input
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            className="input"
          />
        ) : null}

        {period === 'month' ? (
          <input
            type="month"
            value={referenceDate.slice(0, 7)}
            onChange={(e) => setReferenceDate(`${e.target.value}-01`)}
            className="input"
          />
        ) : null}

        {period === 'year' ? (
          <input
            type="number"
            value={referenceDate.slice(0, 4)}
            onChange={(e) => setReferenceDate(`${e.target.value}-01-01`)}
            className="input"
            min="2000"
          />
        ) : null}
      </div>
    </div>
  )
}