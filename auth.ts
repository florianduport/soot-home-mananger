import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { hasEmailServerConfig, sendEmail, getEmailServerConfig } from "@/lib/email";

const emailServerConfig = getEmailServerConfig();
const hasEmailServer = hasEmailServerConfig();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    EmailProvider({
      server: emailServerConfig?.server || {
        host: "localhost",
        port: 1025,
        secure: false,
      },
      from: emailServerConfig?.from || "no-reply@homanager.local",
      async sendVerificationRequest({ identifier, url }) {
        if (!hasEmailServer) {
          console.log("\n\nMagic link (dev):", url, "\n\n");
          return;
        }

        await sendEmail({
          to: identifier,
          subject: "Votre lien de connexion Homanager",
          text: `Cliquez sur ce lien pour vous connecter: ${url}`,
          html: `<p>Cliquez sur ce lien pour vous connecter:</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
