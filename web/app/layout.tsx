import type { Metadata } from "next";
import { Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["400", "600"],
});
const sans = Inter({
  subsets: ["latin"], variable: "--font-sans", display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "NeuroLink: reading Alzheimer's stage from a brain MRI slice",
    template: "%s | NeuroLink",
  },
  description:
    "A student project that trains a small network to read Alzheimer's stage from OASIS brain MRI, and measures how much of the usual 99% accuracy is an artefact of how the data was split.",
  openGraph: {
    title: "NeuroLink",
    description:
      "Training a network to stage Alzheimer's from brain MRI, and measuring how much accuracy comes from splitting the data wrong.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to main content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
