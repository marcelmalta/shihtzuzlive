import type { Metadata } from "next";
import "./globals.css";
import { Cinzel, Poppins } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-title",
  weight: ["400", "600", "700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ShihTzuz",
  description: "Cuidados • Rotina • Diversão",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body className={`${cinzel.variable} ${poppins.variable}`}>
        {children}
      </body>
    </html>
  );
}
