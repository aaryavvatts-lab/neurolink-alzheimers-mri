import type { Metadata } from "next";
import localFont from "next/font/local";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import "./globals.css";

/* Erode, by Indian Type Foundry via Fontshare (ITF Free Font License), self-hosted so the strict
   same-origin Content Security Policy holds and no font service learns who visited. */
const erode = localFont({
  variable: "--font-erode",
  display: "swap",
  src: [
    { path: "./fonts/Erode-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Erode-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Erode-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Erode-Semibold.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "SliceWise: reading Alzheimer's stage from a brain MRI slice",
    template: "%s | SliceWise",
  },
  description:
    "A student project that trains a small network to read Alzheimer's stage from OASIS brain MRI, and measures how much of the usual 99% accuracy is an artefact of how the data was split.",
  openGraph: {
    title: "SliceWise",
    description:
      "Training a network to stage Alzheimer's from brain MRI, and measuring how much accuracy comes from splitting the data wrong.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

// Runs before first paint: marks JavaScript as working and applies a saved theme.
const themeHead =
  "(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')d.setAttribute('data-theme',t);}catch(e){}})();";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={erode.variable} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#f4f3ef" />
        <script dangerouslySetInnerHTML={{ __html: themeHead }} />
      </head>
      <body>
        <a href="#main" className="skip">Skip to main content</a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
