import { z } from 'zod';

export const LIMITS = {
  name: 80,
  nickname: 30,
  email: 254,
  phone: 20,
  teamCode: 64,
  password: 128,
  teamName: 80,
  teamTag: 24,
} as const;

export const PASSWORD_REQUIREMENTS = 'Use de 8 a 128 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.';

export const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
export const isValidPhone = (phone: string) => /^\d{10,15}$/.test(normalizePhone(phone));
export const isValidEmail = (email: string) => email.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const strongPasswordSchema = z.string().max(LIMITS.password, `Use no máximo ${LIMITS.password} caracteres`).refine(
  (password) => password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password),
  PASSWORD_REQUIREMENTS,
);

export const isStrongPassword = (password: string) => strongPasswordSchema.safeParse(password).success;

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido').max(LIMITS.email),
  password: z.string().min(6, 'Use pelo menos 6 caracteres').max(LIMITS.password),
});

export const registerSchema = z.object({
  email: z.email('Informe um e-mail válido').max(LIMITS.email),
  password: strongPasswordSchema,
  name: z.string().trim().min(3, 'Informe seu nome completo').max(LIMITS.name, `Use no máximo ${LIMITS.name} caracteres`),
  nickname: z.string().trim().min(2, 'Informe um apelido').max(LIMITS.nickname, `Use no máximo ${LIMITS.nickname} caracteres`),
  phone: z.string().max(LIMITS.phone).refine(isValidPhone, 'Informe um telefone válido com DDD'),
  teamCode: z.string().trim().min(6, 'Informe o código da equipe').max(LIMITS.teamCode, `Use no máximo ${LIMITS.teamCode} caracteres`),
});

export const profileSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo').max(LIMITS.name),
  nickname: z.string().trim().min(2, 'Informe um apelido').max(LIMITS.nickname),
  phone: z.string().max(LIMITS.phone).refine(isValidPhone, 'Informe um telefone válido com DDD'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
