/**
 * Security question catalog. `id` is 1-based index — must match `users.security_q{1,2,3}_id` in Supabase.
 * If you reorder or remove entries, migrate existing user rows first.
 */
export const SECURITY_QUESTIONS = [
  { id: 1, label: "What is your favorite teacher's last name?" },
  { id: 2, label: 'What city were you born in?' },
  { id: 3, label: 'What was the name of your first pet?' },
  { id: 4, label: 'What was the name of your first school?' },
  { id: 5, label: 'What is the name of your favorite book or movie?' },
  { id: 6, label: 'What was the name of the street you grew up on?' },
  { id: 7, label: 'What is your favorite food?' },
  { id: 8, label: 'What was the first name of your childhood best friend?' },
] as const

export type SecurityQuestionId = (typeof SECURITY_QUESTIONS)[number]['id']

export function securityQuestionLabel(id: SecurityQuestionId): string {
  const row = SECURITY_QUESTIONS.find((q) => q.id === id)
  return row?.label ?? ''
}
