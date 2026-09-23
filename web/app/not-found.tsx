import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">That robot isn&rsquo;t in the catalog yet.</p>
      <Link href="/" className="mt-6 inline-block underline underline-offset-4">
        Back to all robots
      </Link>
    </div>
  );
}
