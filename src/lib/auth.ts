import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      organizationId: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    organizationId?: string;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER';
  }
}

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          organizationId: user.organizationId,
          role: user.role,
        } as unknown as { id: string; email: string; name?: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; organizationId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' };
        token.userId = u.id;
        token.organizationId = u.organizationId;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.organizationId = token.organizationId as string;
        session.user.role = token.role as 'OWNER' | 'ADMIN' | 'MEMBER';
      }
      return session;
    },
  },
};
