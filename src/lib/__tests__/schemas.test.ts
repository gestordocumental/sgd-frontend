import { describe, it, expect } from 'vitest'
import {
  emailField,
  passwordField,
  newPasswordField,
  requiredString,
  optionalString,
  loginSchema,
} from '../validations/schemas'

// ── emailField ────────────────────────────────────────────────────────────────
describe('emailField', () => {
  it('accepts a valid email', () => {
    expect(emailField.safeParse('user@example.com').success).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = emailField.safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('validation.email.required')
  })

  it('rejects a string without @', () => {
    const result = emailField.safeParse('notanemail')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('validation.email.invalid')
  })

  it('rejects a string without domain', () => {
    expect(emailField.safeParse('user@').success).toBe(false)
  })
})

// ── passwordField (login — only non-empty) ────────────────────────────────────
describe('passwordField', () => {
  it('accepts any non-empty string', () => {
    expect(passwordField.safeParse('abc').success).toBe(true)
    expect(passwordField.safeParse('short').success).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = passwordField.safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('validation.password.required')
  })
})

// ── newPasswordField ──────────────────────────────────────────────────────────
describe('newPasswordField', () => {
  const VALID = 'Secure@Pass9!'

  it('accepts a valid strong password', () => {
    expect(newPasswordField.safeParse(VALID).success).toBe(true)
  })

  it('rejects passwords shorter than 8 characters', () => {
    const result = newPasswordField.safeParse('Ab@1234')
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((i) => i.message)
    expect(messages).toContain('validation.password.minLength')
  })

  it('rejects passwords with spaces', () => {
    const result = newPasswordField.safeParse('Secure @123')
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((i) => i.message)
    expect(messages).toContain('validation.password.noSpaces')
  })

  it('rejects passwords without uppercase letter', () => {
    const result = newPasswordField.safeParse('secure@123')
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((i) => i.message)
    expect(messages).toContain('validation.password.uppercase')
  })

  it('rejects passwords without special character', () => {
    const result = newPasswordField.safeParse('SecurePass1')
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((i) => i.message)
    expect(messages).toContain('validation.password.specialChar')
  })

  it('rejects passwords with consecutive number sequences', () => {
    const result = newPasswordField.safeParse('Secure@123456')
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((i) => i.message)
    expect(messages).toContain('validation.password.noConsecutive')
  })
})

// ── requiredString ────────────────────────────────────────────────────────────
describe('requiredString', () => {
  it('accepts a non-empty string', () => {
    expect(requiredString('label').safeParse('hello').success).toBe(true)
  })

  it('rejects an empty string', () => {
    const result = requiredString('label').safeParse('')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('validation.required')
  })
})

// ── optionalString ────────────────────────────────────────────────────────────
describe('optionalString', () => {
  it('accepts a string', () => {
    expect(optionalString.safeParse('hello').success).toBe(true)
  })

  it('accepts undefined', () => {
    expect(optionalString.safeParse(undefined).success).toBe(true)
  })
})

// ── loginSchema ───────────────────────────────────────────────────────────────
describe('loginSchema', () => {
  it('validates a correct login form', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'anypass' })
    expect(result.success).toBe(true)
  })

  it('fails when email is missing', () => {
    const result = loginSchema.safeParse({ email: '', password: 'anypass' })
    expect(result.success).toBe(false)
  })

  it('fails when password is missing', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })
})
