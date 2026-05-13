import type { Metadata } from "next";
import { Noto_Sans_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { NotificationProvider } from "@/components/notification-provider";
import { NotificationToast } from "@/components/notification-bell";

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BookTown",
  description: "Gamified reading tracker with a persistent 3D town.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={notoSansMono.variable}>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <NotificationToast />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
