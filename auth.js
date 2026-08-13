import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const allowedEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  })],
  secret: process.env.AUTH_SECRET,
  pages: { signIn: '/admin-berita' },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET || !allowedEmails.length) return false;
      return Boolean(email && allowedEmails.includes(email));
    },
    async session({ session }) {
      if (session.user?.email) session.user.email = session.user.email.trim().toLowerCase();
      return session;
    },
  },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
});
