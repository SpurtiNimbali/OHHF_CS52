import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

/**
 * Use the same normalizer for hashing at sign-up and for comparison at sign-in.
 */
export function normalizeSecurityAnswer(raw: string): string {
  return raw.trim().toLowerCase()
}

export async function hashSecurityAnswerBcrypt(plain: string): Promise<string> {
  return bcrypt.hash(normalizeSecurityAnswer(plain), BCRYPT_ROUNDS)
}

export function verifySecurityAnswerBcrypt(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(normalizeSecurityAnswer(plain), hash)
}
