import { z } from 'zod';

// ── Campos reutilizables ─────────────────────────────────────────────────────

export const emailField = z
  .string()
  .min(1, 'validation.email.required')
  .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'validation.email.invalid');

// For login forms — only checks that it is not empty
export const passwordField = z.string().min(1, 'validation.password.required');

// For creating or changing a password — applies the same rules as the backend
export const newPasswordField = z
  .string()
  .min(1, 'validation.password.required')
  .min(8, 'validation.password.minLength')
  .refine((val) => /^\S+$/.test(val), 'validation.password.noSpaces')
  .refine((val) => /[A-Z]/.test(val), 'validation.password.uppercase')
  .refine(
    (val) => /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(val),
    'validation.password.specialChar',
  )
  .refine(
    (val) => /^(?!.*(?:012|123|234|345|456|567|678|789|890))[\s\S]*$/.test(val),
    'validation.password.noConsecutive',
  );

export const requiredString = () => z.string().trim().min(1, 'validation.required');

export const optionalString = z.string().optional();

// ── Schemas de formularios ───────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type LoginFormValues = z.infer<typeof loginSchema>;
