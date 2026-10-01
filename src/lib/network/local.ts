import os from "node:os";

export interface LocalNetworkAddress {
  name: string;
  address: string;
  internal: boolean;
}

function isIpv4(family: string | number | undefined): boolean {
  return family === "IPv4" || family === 4;
}

export function getLocalNetworkAddresses(): LocalNetworkAddress[] {
  const interfaces = os.networkInterfaces();
  const results: LocalNetworkAddress[] = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (!isIpv4(entry.family) || entry.internal) continue;
      results.push({
        name,
        address: entry.address,
        internal: entry.internal,
      });
    }
  }

  return results.sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName !== 0 ? byName : left.address.localeCompare(right.address);
  });
}

export function getNetworkFingerprint(addresses: LocalNetworkAddress[]): string {
  return addresses.map((entry) => `${entry.name}:${entry.address}`).join("|");
}

export function resolveAppPort(hostHeader: string | null, fallback = 4002): number {
  const fromHeader = hostHeader?.split(":").at(-1);
  const parsed = Number(fromHeader ?? process.env.PORT ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildLocalShareUrls(addresses: LocalNetworkAddress[], port: number): string[] {
  return addresses.map((entry) => `http://${entry.address}:${port}`);
}

export interface LocalNetworkInfo {
  port: number;
  hostHeader: string | null;
  addresses: LocalNetworkAddress[];
  urls: string[];
  primaryUrl: string | null;
  fingerprint: string;
  listenAllInterfaces: boolean;
}

export function getLocalNetworkInfo(hostHeader: string | null): LocalNetworkInfo {
  const addresses = getLocalNetworkAddresses();
  const port = resolveAppPort(hostHeader);
  const urls = buildLocalShareUrls(addresses, port);

  return {
    port,
    hostHeader,
    addresses,
    urls,
    primaryUrl: urls[0] ?? null,
    fingerprint: getNetworkFingerprint(addresses),
    listenAllInterfaces:
      process.env.MAXREACH_LISTEN_ALL === "1" || process.env.NODE_ENV === "development",
  };
}
