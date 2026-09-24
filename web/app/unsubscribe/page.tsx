import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeForm } from "./UnsubscribeForm";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Remove your email from Ohmlot price and stock alerts.",
};

export default function UnsubscribePage() {
  return (
    <div className="mx-auto max-w-md py-16 sm:py-24">
      <h1 className="text-[24px] font-bold">Unsubscribe</h1>
      <div className="mt-4">
        <Suspense fallback={<p className="text-[14px] text-ink-2">Working&hellip;</p>}>
          <UnsubscribeForm />
        </Suspense>
      </div>
    </div>
  );
}
