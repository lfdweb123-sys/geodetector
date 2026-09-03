import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/apiResponse';

export const runtime = 'nodejs';

const registerSchema = z.object({
  organizationName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(200),
  name: z.string().min(1).max(120).optional(),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'org'
  );
}

/** Creates the first organization + OWNER user. There is no self-service invite flow yet - additional members must be added directly in the database or a future admin endpoint. */
export async function POST(req: NextRequest) {
  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) return jsonError(422, 'Invalid request body', parsed.error.flatten());
  const { organizationName, email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return jsonError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const baseSlug = slugify(organizationName);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const org = await prisma.organization.create({
    data: {
      name: organizationName,
      slug,
      users: {
        create: { email: email.toLowerCase(), passwordHash, name, role: 'OWNER' },
      },
    },
    include: { users: true },
  });

  return jsonOk({ data: { organizationId: org.id, userId: org.users[0]!.id } }, 201);
}
