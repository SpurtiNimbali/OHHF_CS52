import express from 'express'
import './env.js'
import checkInRouter from './routes/checkIn.js'
import chatRouter from './routes/chat.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/check-in', checkInRouter)
app.use('/api/chat', chatRouter)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Cardea API server running on http://localhost:${PORT}`)
})

export default app
