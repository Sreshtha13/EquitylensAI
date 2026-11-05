import { z } from 'zod';

const normalizeUrl = (val: unknown) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.preprocess(
    normalizeUrl,
    z.string().url().default('http://localhost:4000'),
  ),
});

export type FrontendEnv = z.infer<typeof envSchema>;

export function getFrontendEnv(): FrontendEnv {
  return envSchema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });
}
