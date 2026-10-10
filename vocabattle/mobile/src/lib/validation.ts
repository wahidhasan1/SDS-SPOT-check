export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
export const validUsername = (u: string) => /^[A-Za-z0-9_]{3,20}$/.test(u);
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letters and at least one number.';
  return null;
}
