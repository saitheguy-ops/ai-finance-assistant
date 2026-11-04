import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page or ticker doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">
        Back to dashboard
      </Link>
    </div>
  );
}
