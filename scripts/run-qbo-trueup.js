const dotenv = require('dotenv')

dotenv.config({ path: '.env.local' })

async function run() {
  const token = process.env.INTERNAL_SYNC_TOKEN
  const base = 'http://localhost:3000/api/qb-time/sync'
  const headers = token ? { 'x-internal-sync-token': token } : {}
  const argType = (process.argv[2] || '').trim()
  const argYear = Number(process.argv[3])
  const argMonth = Number(process.argv[4])
  const jobs =
    argType === 'time' && Number.isInteger(argYear) && Number.isInteger(argMonth) && argMonth >= 1 && argMonth <= 12
      ? [{ type: 'time', year: argYear, month: argMonth }]
      : argType === 'time' && Number.isInteger(argYear)
        ? [{ type: 'time', year: argYear }]
        : argType === 'invoices'
          ? [{ type: 'invoices' }]
          : [
              { type: 'time', year: 2023 },
              { type: 'time', year: 2024 },
              { type: 'time', year: 2025 },
              { type: 'time', year: 2026 },
              { type: 'invoices' },
            ]

  for (const job of jobs) {
    const url = job.year
      ? job.month
        ? `${base}?type=${job.type}&year=${job.year}&month=${job.month}`
        : `${base}?type=${job.type}&year=${job.year}`
      : `${base}?type=${job.type}`
    const res = await fetch(url, { method: 'POST', headers })
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    console.log(
      JSON.stringify(
        {
          job,
          status: res.status,
          ok: res.ok,
          body,
        },
        null,
        2
      )
    )
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
