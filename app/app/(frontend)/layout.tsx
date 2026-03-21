import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Footer } from "@/components/layout/footer";
import { SiteNav } from "@/components/layout/SiteNav";
import { NavProvider } from "@/components/layout/NavContext";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kuara | Saber irradia de dentro",
  description:
    "Conteúdo das disciplinas de Engenharia Mecatrônica e tantas outras coisas...",
  keywords: [
    "kuara",
    "conteúdo de disciplina",
    "engenharia mecatrônica",
    "robótica",
    "sistemas supervisórios",
  ],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
  },
  openGraph: {
    title: "Kuara | Saber irradia de dentro",
    description:
      "Conteúdo das disciplinas de Engenharia Mecatrônica e tantas outras coisas...",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NavProvider>
            <SiteNav />
            <main className="flex-1">{children}</main>
            <Footer />
          </NavProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
