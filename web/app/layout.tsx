import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroLink — Alzheimer's staging from brain MRI",
  description:
    "An honest attempt to stage Alzheimer's from OASIS-1 brain MRI, and a demonstration of why the usual version of this project reports 99% accuracy that means nothing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="sticky top-0 z-50 border-b border-warn/30 bg-warn/10 backdrop-blur">
          <p className="mx-auto max-w-6xl px-4 py-2 text-center text-xs text-red-200">
            <strong className="font-semibold">Research demonstration — not a medical device.</strong>{" "}
            This model is not validated for clinical use and must not inform any real diagnosis.
          </p>
        </div>
        {children}
        <footer className="border-t border-line/60 mt-24">
          <div className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted space-y-2">
            <p>
              Built on the OASIS-1 cross-sectional MRI dataset. Labels are Clinical Dementia
              Rating scores assigned by clinicians, not autopsy-confirmed diagnoses.
            </p>
            <p>
              Model runs entirely in your browser via onnxruntime-web. No image you open here is
              uploaded anywhere.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
