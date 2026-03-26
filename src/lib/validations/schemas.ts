import { z } from 'zod'

// ── Campos reutilizables ─────────────────────────────────────────────────────

export const emailField = z
  .string()
  .min(1, 'Email is required')
  .refine(
    (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    'Enter a valid email address',
  )

// For login forms — only checks that it is not empty
export const passwordField = z
  .string()
  .min(1, 'Password is required')

// For creating or changing a password — applies the same rules as the backend
export const newPasswordField = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .refine((val) => /^\S+$/.test(val), 'Password must not contain spaces')
  .refine((val) => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter')
  .refine(
    (val) => /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(val),
    'Password must contain at least one special character',
  )
  .refine(
    (val) => /^(?!.*(?:012|123|234|345|456|567|678|789|890))[\s\S]*$/.test(val),
    'Password must not contain consecutive numbers (e.g. 123, 456)',
  )

export const requiredString = (label: string) =>
  z.string().min(1, `${label} is required`)

// ── Schemas de formularios ───────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
})

export type LoginFormValues = z.infer<typeof loginSchema>
