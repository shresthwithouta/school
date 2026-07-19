
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { InlineScript } from "@/components/inline-script";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  applicationName: "SWM",
  title: {
    default: "School Workforce Management",
    template: "%s · SWM",
  },
  description:
    "Centralized platform to assign, track, review and evaluate tasks across all school stakeholders.",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SWM",
  },
};

export const viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}

) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved theme class before the browser paints, so there's
            no flash of the default (light) theme. Lives here — not inside a
            Client Component — per Next's recommended pattern; see
            node_modules/next/dist/docs/.../preventing-flash-before-hydration.md. */}
        <InlineScript
          html={`(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="reading")document.documentElement.classList.add(t)}catch(e){}})()`}
        />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
