# Crisis Detection System - Setup Instructions

## 1. Database Setup (Required)

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Copy the SQL schema from `src/lib/databaseSchema.ts`
4. Paste and execute the query
5. Verify the `flagged_messages` table appears in **Table Editor**

## 2. Environment Variables (Required)

You need to add `SUPABASE_SERVICE_ROLE_KEY` to your `.env` file for the crisis detection API to work.

**Current .env:**
```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
```

**Add this:**
```
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**How to get SUPABASE_SERVICE_ROLE_KEY:**
1. Go to Supabase dashboard
2. Project Settings → **API**
3. Under "Project API keys", copy the **Service Role** key (keep this secret!)
4. Add it to your `.env` file

## 3. Files Created

### `src/lib/crisisKeywords.ts`
- List of crisis keywords and phrases
- `detectCrisisKeywords()` function
- Crisis hotline resources
- Regular expressions for efficient matching

### `src/components/CrisisCard.tsx`
- React component that displays crisis resources
- Shows hotlines and support links
- Indicates that message is flagged for staff review
- Customizable via `showIcon` and `compact` props

### `api/crisis-check.ts`
- Server-side API endpoint: `POST /api/crisis-check`
- Checks messages for crisis keywords
- Automatically flags in database if detected
- Returns `{ isCrisis: boolean, flagged: boolean }`

### `src/lib/crisisDetectionClient.ts`
- Client-side helper functions
- `checkForCrisis()`: Call the API
- `processMessageWithCrisisCheck()`: Check before sending to AI
- Ready to integrate with your chat component

### `src/lib/databaseSchema.ts`
- SQL schema for `flagged_messages` table
- Database setup instructions

## 4. Integration Example

In your chat component:

```tsx
import { processMessageWithCrisisCheck } from '../lib/crisisDetectionClient'
import CrisisCard from '../components/CrisisCard'

function YourChatComponent() {
  const handleSendMessage = async (userMessage: string) => {
    // Check for crisis keywords BEFORE calling AI
    const result = await processMessageWithCrisisCheck(
      userMessage,
      userId,           // optional
      conversationId    // optional
    )
    
    if (result.isCrisis) {
      // Show crisis card and skip AI
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'crisis',
        component: <CrisisCard />
      }])
      return
    }
    
    // Normal flow: call your AI endpoint
    const aiResponse = await callYourAI(userMessage)
    setMessages(prev => [...prev, {
      type: 'assistant',
      content: aiResponse
    }])
  }
  
  return (
    <div>
      {messages.map(msg => 
        msg.type === 'crisis' ? msg.component : <div>{msg.content}</div>
      )}
    </div>
  )
}
```

## 5. Staff Review Dashboard

To create a dashboard for staff to review flagged messages:

```tsx
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

function StaffDashboard() {
  const [flagged, setFlagged] = useState([])
  
  useEffect(() => {
    const supabase = createClient(
      process.env.REACT_APP_SUPABASE_URL,
      process.env.REACT_APP_SUPABASE_ANON_KEY
    )
    
    supabase
      .from('flagged_messages')
      .select('*')
      .eq('reviewed', false)
      .order('flagged_at', { ascending: false })
      .then(({ data }) => setFlagged(data || []))
  }, [])
  
  return (
    <div>
      <h2>Crisis Messages to Review</h2>
      {flagged.map(msg => (
        <div key={msg.id}>
          <p>{msg.message_text}</p>
          <p>User: {msg.user_id}</p>
          <p>Time: {new Date(msg.flagged_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}
```

## 6. Keywords Monitored

The system detects:
- **Suicidal ideation**: suicide, kill myself, take my life, hurt myself, etc.
- **Severe depression**: no point, hopeless, worthless, burden
- **Self-harm**: cutting, overdose, self harm
- **Abuse indicators**: domestic violence, assault
- **Child safety**: abuse child, harm child

See `src/lib/crisisKeywords.ts` for complete list and add more as needed.

## 7. Manual Testing

To test the crisis detection:

```bash
# Test the API directly
curl -X POST http://localhost:5173/api/crisis-check \
  -H "Content-Type: application/json" \
  -d '{"text":"I want to kill myself"}'

# Expected response:
# { "isCrisis": true, "flagged": true, "message": "Crisis detected and flagged for review" }
```

## Support

For questions or to add more keywords, edit `src/lib/crisisKeywords.ts` and restart your dev server.
