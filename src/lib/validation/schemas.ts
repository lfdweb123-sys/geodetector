import { z } from 'zod';

export const gpsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
  timestamp: z.number().int().positive(),
  altitude: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
});

export const deviceSignalsSchema = z.object({
  mockLocationStatus: z.enum(['DETECTED', 'NOT_DETECTED', 'UNAVAILABLE']).optional(),
  integrity: z.enum(['PHYSICAL', 'EMULATOR_SUSPECTED', 'COMPROMISED_SUSPECTED', 'UNAVAILABLE']).optional(),
});

export const clientContextSchema = z.object({
  timezone: z.string().max(64).optional(),
  language: z.string().max(32).optional(),
});

export const createVerificationSchema = z.object({
  session_id: z.string().min(1).max(200),
  required_country: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  location_permission_denied: z.boolean().optional(),
  location: gpsSchema.nullable().optional(),
  client: clientContextSchema.optional(),
  device: deviceSignalsSchema.optional(),
});

export type CreateVerificationInput = z.infer<typeof createVerificationSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(['STANDARD', 'STRICT', 'HIGH_SECURITY', 'CUSTOM']).default('STANDARD'),
  allowedCountries: z.array(z.string().length(2)).default([]),
  requireLocation: z.boolean().default(true),
  maxAccuracyMeters: z.number().int().positive().max(100000).default(150),
  maxLocationAgeSec: z.number().int().positive().max(86400).default(120),
  minConfidence: z.number().int().min(0).max(100).default(70),
  ipIntelProvider: z.enum(['ipapi', 'ipinfo', 'mock']).default('ipapi'),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createApiKeySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  env: z.enum(['live', 'test']).default('live'),
});

const fieldConditionSchema = z.object({
  field: z.string(),
  op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in']),
  value: z.unknown(),
});

export const ruleConditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    fieldConditionSchema,
    z.object({ and: z.array(ruleConditionSchema) }),
    z.object({ or: z.array(ruleConditionSchema) }),
    z.object({ not: ruleConditionSchema }),
  ]),
);

export const createRuleSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  condition: ruleConditionSchema,
  action: z.enum(['ALLOW', 'BLOCK', 'MANUAL_REVIEW']),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const createWebhookSchema = z.object({
  projectId: z.string().min(1),
  url: z.string().url(),
  events: z
    .array(
      z.enum([
        'verification.completed',
        'verification.verified',
        'verification.suspicious',
        'verification.rejected',
      ]),
    )
    .min(1),
});
