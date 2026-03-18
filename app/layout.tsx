import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Milestone Rewards",
  description: "Set weight goals, earn rewards for every milestone you hit. Track your journey with friends.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  openGraph: {
    title: "Milestone Rewards",
    description: "Set weight goals, earn rewards for every milestone you hit.",
    siteName: "Milestone Rewards",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Milestone Rewards",
    description: "Set weight goals, earn rewards for every milestone you hit.",
  },
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fdf6f9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Nunito+Sans:wght@200;300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"))` }} />
      </body>
    </html>
  );
}
