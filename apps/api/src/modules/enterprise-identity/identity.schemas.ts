import { z } from 'zod';

const IdentityProviderFields = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,50}$/),
  type: z.enum(['OIDC', 'SAML']),
  enabled: z.boolean(),
  issuer: z.string().url().optional(),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(8).optional(),
  samlEntityId: z.string().min(1).optional(),
  samlSsoUrl: z.string().url().optional(),
  samlCertificate: z.string().min(1).optional(),
  allowedDomains: z.array(z.string().trim().toLowerCase()),
  defaultRole: z.enum([
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'STUDENT',
    'PARENT',
  ]),
  jitProvisioning: z.boolean(),
  enforceSso: z.boolean(),
});

// PATCH must not apply create defaults or discard cross-field validation.
export const IdentityProviderPatchSchema = IdentityProviderFields.partial();
export const IdentityProviderSchema = IdentityProviderFields.extend({
  enabled: z.boolean().default(false),
  allowedDomains: z.array(z.string().trim().toLowerCase()).default([]),
  defaultRole: IdentityProviderFields.shape.defaultRole.default('TEACHER'),
  jitProvisioning: z.boolean().default(false),
  enforceSso: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.type === 'OIDC' && (!value.issuer || !value.clientId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OIDC issuer and clientId are required',
    });
  }
  if (
    value.type === 'SAML' &&
    (!value.samlEntityId || !value.samlSsoUrl || !value.samlCertificate)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SAML entity ID, SSO URL and signing certificate are required',
    });
  }
});

export const BreakGlassRequestSchema = z.object({
  schoolId: z.string().min(1),
  reason: z.string().trim().min(20).max(1000),
});

export const BreakGlassApproveSchema = z.object({
  durationMinutes: z.number().int().min(5).max(120).default(30),
});

export const BreakGlassRevokeSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export const ScimTokenSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  expiresAt: z.string().datetime().optional(),
});
