import { z } from 'zod'

// ── Campos reutilizables ─────────────────────────────────────────────────────

export const emailField = z
  .string()
  .min(1, 'El correo electrónico es requerido')
  .refine(
    (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    'Ingresa un correo electrónico válido',
  )

// Para formularios de login — solo verifica que no esté vacío
export const passwordField = z
  .string()
  .min(1, 'La contraseña es requerida')

// Para crear o cambiar contraseña — aplica las mismas reglas del backend
export const newPasswordField = z
  .string()
  .min(1, 'La contraseña es requerida')
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((val) => /^\S+$/.test(val), 'La contraseña no debe contener espacios')
  .refine((val) => /[A-Z]/.test(val), 'La contraseña debe contener al menos una letra mayúscula')
  .refine(
    (val) => /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(val),
    'La contraseña debe contener al menos un carácter especial',
  )
  .refine(
    (val) => /^(?!.*(?:012|123|234|345|456|567|678|789|890))[\s\S]*$/.test(val),
    'La contraseña no debe contener números consecutivos (ej. 123, 456)',
  )

export const requiredString = (label: string) =>
  z.string().min(1, `${label} es requerido`)

// ── Schemas de formularios ───────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
})

export type LoginFormValues = z.infer<typeof loginSchema>
