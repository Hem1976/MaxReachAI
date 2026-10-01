import assert from "node:assert/strict";
import {
  buildLocalShareUrls,
  getLocalNetworkAddresses,
  getLocalNetworkInfo,
  getNetworkFingerprint,
  resolveAppPort,
} from "../src/lib/network/local.ts";

const addresses = getLocalNetworkAddresses();
assert.ok(Array.isArray(addresses), "addresses should be an array");

for (const entry of addresses) {
  assert.match(entry.address, /^\d+\.\d+\.\d+\.\d+$/, "expected IPv4 address");
  assert.equal(entry.internal, false, "expected external interface");
}

assert.equal(resolveAppPort("192.168.1.5:3000"), 3000);
assert.equal(resolveAppPort("localhost"), 4002);
assert.equal(resolveAppPort(null, 8080), 8080);

const urls = buildLocalShareUrls(
  [{ name: "Wi-Fi", address: "192.168.1.42", internal: false }],
  3000,
);
assert.deepEqual(urls, ["http://192.168.1.42:3000"]);

const info = getLocalNetworkInfo("localhost:3000");
assert.equal(info.port, 3000);
assert.equal(info.fingerprint, getNetworkFingerprint(info.addresses));
assert.equal(typeof info.listenAllInterfaces, "boolean");

console.log("network local tests passed", {
  addressCount: addresses.length,
  sample: info.primaryUrl,
});
