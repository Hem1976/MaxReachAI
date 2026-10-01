"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LocalNetworkInfo } from "@/lib/network/local";
import { cn } from "@/lib/utils";

const POLL_MS = 5000;

export function LocalShareCard() {
  const [network, setNetwork] = useState<LocalNetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fingerprintRef = useRef("");

  const refresh = useCallback(async (announceChange = false) => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/network/local", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not read local network info.");
      }

      const next = payload.network as LocalNetworkInfo;
      if (
        announceChange &&
        fingerprintRef.current &&
        fingerprintRef.current !== next.fingerprint
      ) {
        toast.info("Your WiFi network changed — share link updated.");
      }
      fingerprintRef.current = next.fingerprint;
      setNetwork(next);
    } catch (cause) {
      if (announceChange) {
        toast.error(cause instanceof Error ? cause.message : "Network refresh failed.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async (announceChange: boolean) => {
      if (cancelled) return;
      await refresh(announceChange);
    };

    void run(false);
    const timer = window.setInterval(() => void run(true), POLL_MS);

    const onOnline = () => void run(true);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  const ready = Boolean(network?.primaryUrl);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "size-2 rounded-full",
                ready ? "bg-success" : loading ? "bg-warning" : "bg-danger",
              )}
            />
            <CardTitle>Share on local WiFi</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={network?.listenAllInterfaces ? "success" : "warning"}>
              {network?.listenAllInterfaces ? "LAN access on" : "Restart dev server"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh(true)}
              disabled={refreshing}
            >
              {refreshing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Open this link on another laptop, phone, or tablet on the same WiFi. The
          address updates automatically when your network changes.
        </p>

        {loading && !network ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Detecting local network address…
          </div>
        ) : null}

        {network?.primaryUrl ? (
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Primary link</p>
                <p className="mt-1.5 break-all font-mono text-sm text-foreground">
                  {network.primaryUrl}
                </p>
              </div>
              <CopyButton
                value={network.primaryUrl}
                label="Copy link"
                successMessage="WiFi link copied"
              />
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            No WiFi or Ethernet address was found. Connect to a network, then click
            Refresh.
          </p>
        )}

        {network && network.urls.length > 1 ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            {network.addresses.map((entry) => {
              const url = `http://${entry.address}:${network.port}`;
              return (
                <div key={`${entry.name}:${entry.address}`} className="rounded-lg border border-border px-4 py-3">
                  <dt className="flex items-center gap-1.5 eyebrow">
                    <Wifi className="size-3.5" />
                    {entry.name}
                  </dt>
                  <dd className="mt-1.5 break-all font-mono text-xs text-foreground">{url}</dd>
                  <div className="mt-2">
                    <CopyButton
                      value={url}
                      label="Copy"
                      size="iconSm"
                      variant="ghost"
                      successMessage={`${entry.name} link copied`}
                    />
                  </div>
                </div>
              );
            })}
          </dl>
        ) : null}

        {!network?.listenAllInterfaces ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Run <span className="font-mono text-foreground">npm run dev</span> and restart
            the dev server so it listens on all network interfaces. Other devices cannot
            connect until you do.
          </p>
        ) : null}

        <p className="text-xs text-subtle-foreground">
          Checked every {Math.round(POLL_MS / 1000)}s · port {network?.port ?? 4002}
        </p>
      </CardContent>
    </Card>
  );
}
