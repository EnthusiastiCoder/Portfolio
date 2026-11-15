import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-16">
      <div className="panel p-6 sm:p-10">
        <p className="prompt text-sm" aria-hidden="true">
          cd /requested/path
        </p>
        <h1 className="text-accent text-glow mt-2 text-3xl font-bold">404: path not found</h1>
        <p className="mt-4 leading-relaxed">
          This page does not exist in this version of the Matrix. The link may be old or mistyped.
        </p>
        <p className="mt-6">
          <Link href="/" className="btn">
            Return to the home page
          </Link>
        </p>
      </div>
    </main>
  );
}
