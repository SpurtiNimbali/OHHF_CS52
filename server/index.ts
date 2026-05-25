import express from 'express'
import './env.js'
import checkInRouter from './routes/checkIn.js'
import chatRouter from './routes/chat.js'
import careTeamQuestionsRouter from './routes/careTeamQuestions.js'
import moodEntriesRouter from './routes/moodEntries.js'
import journalEntriesRouter from './routes/journalEntries.js'
import userReframesRouter from './routes/userReframes.js'
import safePlacesRouter from './routes/safePlaces.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/check-in', checkInRouter)
app.use('/api/chat', chatRouter)
app.use('/api/care-team-questions', careTeamQuestionsRouter)
app.use('/api/mood-entries', moodEntriesRouter)
app.use('/api/journal-entries', journalEntriesRouter)
app.use('/api/user-reframes', userReframesRouter)
app.use('/api/safe-places', safePlacesRouter)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Cardea API server running on http://localhost:${PORT}`)
})

export default app
