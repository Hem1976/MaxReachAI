import Image from "next/image";

import { cn } from "@/lib/utils";

const LOGO_SRC = "/MAXPRO-LOGO-FINAL-3.png";

export function Logomark({ className }: { className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Maxpro"
      width={160}
      height={48}
      className={cn("h-9 w-auto object-contain object-left", className)}
      priority
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Image
        src={LOGO_SRC}
        alt="Maxpro Infotech — We mind your growth"
        width={168}
        height={52}
        className="h-10 w-auto max-w-[168px] object-contain object-left"
        priority
      />
      <span className="font-mono text-[0.625rem] tracking-[0.08em] text-subtle-foreground uppercase">
        MaxReach AI
      </span>
    </div>
  );
}
