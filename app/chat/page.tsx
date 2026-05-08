import { Metadata } from 'next'
import ChatPageClient from '@/components/chat/ChatPageClient'

export const metadata: Metadata = {
  title: 'Mental Health Support | Cardea',
  description: 'Confidential, compassionate support for heart families.',
}

export default function ChatPage() {
  return <ChatPageClient />
}
