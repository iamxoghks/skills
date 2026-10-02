import assert from "node:assert/strict";
import test from "node:test";
import { ThermalPrinterRenderer } from "../dist/core/thermal-printer.js";

// USB operations are mocked before use. The native module load test only checks
// exports; this suite never enumerates devices, opens one, or sends a print job.
const receipt = {
  location: "The Cloud",
  config: { timezone: "UTC", locale: "en" },
  transcriptData: {
    sessionId: "fixture-session",
    sessionSlug: "fixture-session",
    startTime: new Date("2026-01-01T00:00:00Z"),
    endTime: new Date("2026-01-01T00:00:00Z"),
    messages: [],
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolUses: 0,
    filesModified: [],
    commandsRun: [],
  },
  sessionData: {
    sessionId: "fixture-session",
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelsUsed: ["codex"],
    modelBreakdowns: [],
    projectPath: "/tmp/fixture-session.jsonl",
  },
};

function alternate({ setting = 0, classCode = 7, endpoints = [outEndpoint()] } = {}) {
  return {
    alternateSetting: setting,
    interfaceClass: classCode,
    interfaceSubclass: 1,
    interfaceProtocol: 2,
    endpoints,
  };
}

function outEndpoint(number = 2) {
  return { endpointNumber: number, direction: "out", type: "bulk", packetSize: 64 };
}

function iface(number = 0, alternates = [alternate()]) {
  return { interfaceNumber: number, alternate: alternates[0], alternates, claimed: false };
}

function mockPrinter(options = {}) {
  const events = [];
  const transfers = [];
  const configuration = options.configuration ?? {
    configurationValue: 1,
    interfaces: [iface()],
  };
  let claimAttempts = 0;
  const device = {
    vendorId: 0x04b8,
    productId: 0x0202,
    configuration: options.unconfigured ? null : configuration,
    configurations: options.noConfigurations ? [] : [configuration],
    async open() {
      events.push(["open"]);
      if (options.openError) throw options.openError;
    },
    async selectConfiguration(value) {
      events.push(["configuration", value]);
      if (options.configurationError) throw options.configurationError;
      if (!options.selectionLeavesUnconfigured) this.configuration = configuration;
    },
    async claimInterface(number) {
      events.push(["claim", number]);
      claimAttempts++;
      if (claimAttempts <= (options.failedClaims ?? 0)) throw options.claimError ?? new Error("interface busy");
    },
    async detachKernelDriver(number) {
      events.push(["detach", number]);
      if (options.detachError) throw options.detachError;
    },
    async attachKernelDriver(number) {
      events.push(["attach", number]);
      if (options.attachError) throw options.attachError;
    },
    async selectAlternateInterface(number, setting) {
      events.push(["alternate", number, setting]);
      if (options.alternateError) throw options.alternateError;
    },
    async transferOut(number, data) {
      events.push(["transfer", number]);
      transfers.push({ number, data: Uint8Array.from(data) });
      if (options.transferError) throw options.transferError;
      return options.transferResult ?? { status: "ok", bytesWritten: data.byteLength };
    },
    async releaseInterface(number) {
      events.push(["release", number]);
      if (options.releaseError) throw options.releaseError;
    },
    async close() {
      events.push(["close"]);
      if (options.closeError) throw options.closeError;
    },
  };
  const renderer = new ThermalPrinterRenderer();
  renderer.loadUsb = async () => ({
    usb: {
      async findDeviceByIds(vid, pid) {
        events.push(["find", vid, pid]);
        return options.missing ? undefined : device;
      },
      async getDevices() {
        events.push(["devices"]);
        return options.visible ?? [];
      },
    },
  });
  return { renderer, device, events, transfers };
}

async function withPlatform(platform, operation) {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
  try {
    await operation();
  } finally {
    Object.defineProperty(process, "platform", descriptor);
  }
}

test("native USB 3 module loads and exposes WebUSB APIs without accessing devices", async () => {
  const { usb, webusb, WebUSB } = await import("usb");
  assert.equal(typeof WebUSB, "function");
  assert.ok(usb instanceof WebUSB);
  assert.equal(typeof usb.findDeviceByIds, "function");
  assert.equal(typeof usb.getDevices, "function");
  assert.equal(typeof webusb.getDevices, "function");
  assert.equal(typeof webusb.requestDevice, "function");
});

test("default USB prints the full ESC/POS receipt with matching IDs and endpoint", async () => {
  const { renderer, events, transfers } = mockPrinter();
  await renderer.printReceipt(receipt, "usb");
  assert.deepEqual(events, [
    ["find", 0x04b8, 0x0202], ["open"], ["claim", 0],
    ["transfer", 2], ["release", 0], ["close"],
  ]);
  assert.equal(transfers.length, 1);
  const bytes = Buffer.from(transfers[0].data);
  assert.deepEqual(bytes, renderer.buildReceipt(receipt));
  assert.deepEqual([...bytes.subarray(0, 2)], [0x1b, 0x40]);
  assert.deepEqual([...bytes.subarray(-4)], [0x1d, 0x56, 0x42, 3]);
});

test("explicit hexadecimal USB IDs and sliced Buffer bytes survive transfer", async () => {
  for (const spec of ["usb:1A2b:00ff", "usb:0x1A2b:0x00ff"]) {
    const { renderer, events, transfers } = mockPrinter();
    const backing = Buffer.from([99, 0, 255, 27, 29, 88]);
    await renderer.sendViaUsb(backing.subarray(1, 5), spec);
    assert.deepEqual(events[0], ["find", 0x1a2b, 0x00ff]);
    assert.deepEqual([...transfers[0].data], [0, 255, 27, 29]);
  }
});

test("malformed USB IDs fail before loading native USB support", async () => {
  const renderer = new ThermalPrinterRenderer();
  renderer.loadUsb = async () => { throw new Error("native USB must not load"); };
  for (const spec of ["usb:zz:202", "usb:4b8", "usb:10000:202", "usb:4b8:202:extra"]) {
    await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), spec), /Invalid USB printer interface/);
  }
});

test("printer-class interface is preferred over other bulk OUT interfaces", async () => {
  const { renderer, events } = mockPrinter({
    configuration: {
      configurationValue: 1,
      interfaces: [
        iface(0, [alternate({ classCode: 0xff, endpoints: [outEndpoint(1)] })]),
        iface(3, [alternate({ endpoints: [outEndpoint(4)] })]),
      ],
    },
  });
  await renderer.sendViaUsb(Buffer.from([1]), "usb");
  assert.deepEqual(events.slice(2), [["claim", 3], ["transfer", 4], ["release", 3], ["close"]]);
});

test("vendor-specific alternate interface is selected before writing", async () => {
  const { renderer, events } = mockPrinter({
    configuration: {
      configurationValue: 1,
      interfaces: [iface(2, [
        alternate({ classCode: 0xff, endpoints: [] }),
        alternate({ setting: 1, classCode: 0xff, endpoints: [outEndpoint(5)] }),
      ])],
    },
  });
  await renderer.sendViaUsb(Buffer.from([1]), "usb");
  assert.deepEqual(events.slice(2), [
    ["claim", 2], ["alternate", 2, 1], ["transfer", 5], ["release", 2], ["close"],
  ]);
});

test("an unconfigured device selects its descriptor configuration value", async () => {
  const { renderer, events } = mockPrinter({
    unconfigured: true,
    configuration: { configurationValue: 2, interfaces: [iface()] },
  });
  await renderer.sendViaUsb(Buffer.from([1]), "usb");
  assert.deepEqual(events[2], ["configuration", 2]);
});

test("missing device preserves discovery diagnostics without opening visible devices", async () => {
  const { renderer, events } = mockPrinter({
    missing: true,
    visible: [{ vendorId: 0x1234, productId: 0xabcd }],
  });
  await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), (error) => {
    assert.match(error.message, /default Epson TM-T88V 4b8:202/);
    assert.match(error.message, /1234:abcd/);
    assert.match(error.message, /--printer usb:VID:PID/);
    return true;
  });
  assert.deepEqual(events, [["find", 0x04b8, 0x0202], ["devices"]]);
});

test("missing bulk OUT endpoint closes the opened device without claiming it", async () => {
  const { renderer, events } = mockPrinter({
    configuration: {
      configurationValue: 1,
      interfaces: [iface(0, [alternate({ endpoints: [
        { endpointNumber: 2, direction: "in", type: "bulk", packetSize: 64 },
        { endpointNumber: 3, direction: "out", type: "interrupt", packetSize: 8 },
      ] })])],
    },
  });
  await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), /No bulk OUT endpoint/);
  assert.deepEqual(events, [["find", 0x04b8, 0x0202], ["open"], ["close"]]);
});

test("missing configuration and failed configuration selection still close the device", async () => {
  for (const options of [
    { unconfigured: true, noConfigurations: true },
    { unconfigured: true, selectionLeavesUnconfigured: true },
    { unconfigured: true, configurationError: new Error("configuration failed") },
  ]) {
    const { renderer, events } = mockPrinter(options);
    await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), /configuration/i);
    assert.deepEqual(events.at(-1), ["close"]);
    assert.ok(!events.some(([event]) => event === "claim" || event === "transfer"));
  }
});

test("transfer rejection releases and closes without hiding the original error", async () => {
  const transferError = new Error("USB connection lost");
  const { renderer, events } = mockPrinter({
    transferError,
    releaseError: new Error("release failed"),
    closeError: new Error("close failed"),
  });
  await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), (error) => error === transferError);
  assert.deepEqual(events.slice(-2), [["release", 0], ["close"]]);
});

test("stalled, babbled and partial transfers are failures with full cleanup", async () => {
  for (const transferResult of [
    { status: "stall", bytesWritten: 0 },
    { status: "babble", bytesWritten: 0 },
    { status: "ok", bytesWritten: 1 },
  ]) {
    const { renderer, events } = mockPrinter({ transferResult });
    await assert.rejects(renderer.sendViaUsb(Buffer.from([1, 2]), "usb"), /transfer (failed|was incomplete)/);
    assert.deepEqual(events.slice(-2), [["release", 0], ["close"]]);
  }
});

test("open failure does not attempt interface operations or close", async () => {
  const { renderer, events } = mockPrinter({ openError: new Error("open denied") });
  await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), /open denied/);
  assert.deepEqual(events, [["find", 0x04b8, 0x0202], ["open"]]);
});

test("non-Linux claim failure closes without invoking Linux kernel APIs", async () => {
  await withPlatform("darwin", async () => {
    const { renderer, events } = mockPrinter({ failedClaims: 1 });
    await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), /interface busy/);
    assert.deepEqual(events.slice(2), [["claim", 0], ["close"]]);
  });
});

test("Linux busy interface retries claim then releases and restores the kernel driver", async () => {
  await withPlatform("linux", async () => {
    const { renderer, events } = mockPrinter({ failedClaims: 1 });
    await renderer.sendViaUsb(Buffer.from([1]), "usb");
    assert.deepEqual(events.slice(2), [
      ["claim", 0], ["detach", 0], ["claim", 0], ["transfer", 2],
      ["release", 0], ["attach", 0], ["close"],
    ]);
  });
});

test("Linux detach failure preserves claim failure and closes the device", async () => {
  await withPlatform("linux", async () => {
    const claimError = new Error("claim permission denied");
    const { renderer, events } = mockPrinter({
      failedClaims: 1, claimError, detachError: new Error("detach denied"),
    });
    await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), (error) => error === claimError);
    assert.deepEqual(events.slice(2), [["claim", 0], ["detach", 0], ["close"]]);
  });
});

test("Linux retry failure restores detached driver without releasing an unclaimed interface", async () => {
  await withPlatform("linux", async () => {
    const { renderer, events } = mockPrinter({ failedClaims: 2 });
    await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), /interface busy/);
    assert.deepEqual(events.slice(2), [
      ["claim", 0], ["detach", 0], ["claim", 0], ["attach", 0], ["close"],
    ]);
  });
});

test("alternate selection failure releases and closes before propagating the error", async () => {
  const { renderer, events } = mockPrinter({
    configuration: {
      configurationValue: 1,
      interfaces: [iface(0, [alternate({ endpoints: [] }), alternate({ setting: 1 })])],
    },
    alternateError: new Error("alternate failed"),
  });
  await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), /alternate failed/);
  assert.deepEqual(events.slice(-2), [["release", 0], ["close"]]);
  assert.ok(!events.some(([event]) => event === "transfer"));
});

test("cleanup failure is surfaced after a successful transfer and still attempts close", async () => {
  const releaseError = new Error("release failed");
  const { renderer, events } = mockPrinter({ releaseError });
  await assert.rejects(renderer.sendViaUsb(Buffer.from([1]), "usb"), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /USB printer cleanup failed/);
    assert.deepEqual(error.errors, [releaseError]);
    return true;
  });
  assert.deepEqual(events.slice(-2), [["release", 0], ["close"]]);
});

test("TCP and CUPS routes retain receipt bytes and never load USB", async () => {
  const renderer = new ThermalPrinterRenderer();
  const calls = [];
  renderer.loadUsb = async () => { throw new Error("native USB must not load"); };
  renderer.sendViaTcp = async (buffer, spec) => calls.push(["tcp", spec, buffer]);
  renderer.sendViaCups = async (buffer, spec) => calls.push(["cups", spec, buffer]);
  await renderer.printReceipt(receipt, "tcp://printer.example:9100");
  await renderer.printReceipt(receipt, "Office_Printer");
  assert.deepEqual(calls.map(([route, spec]) => [route, spec]), [
    ["tcp", "tcp://printer.example:9100"], ["cups", "Office_Printer"],
  ]);
  assert.deepEqual(calls[0][2], renderer.buildReceipt(receipt));
  assert.deepEqual(calls[1][2], calls[0][2]);
});
