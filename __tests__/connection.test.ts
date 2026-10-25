/**
 * @jest-environment node
 */
// Connection test: talks to the REAL cloud service, so Laragon (Apache + MySQL) must be running.
// It only reads data, so it is safe to run against your real database.
import http from "http";

import { getEvents } from "../src/api";

// The jest-expo test setup replaces fetch() with a fake that cannot use the network,
// so give the app a small real fetch() built on Node's http module.
beforeAll(() => {
  global.fetch = ((url: string) =>
    new Promise((resolve, reject) => {
      http
        .get(url, (response) => {
          let body = "";
          response.on("data", (chunk) => (body += chunk));
          response.on("end", () => resolve({ json: async () => JSON.parse(body) }));
        })
        .on("error", reject);
    })) as unknown as typeof fetch;
});

test("connects to the cloud service and gets the event list", async () => {
  const events = await getEvents("", "");

  expect(Array.isArray(events)).toBe(true);
  for (const event of events) {
    expect(typeof event.id).toBe("string");
    expect(typeof event.name).toBe("string");
    expect(event.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(typeof event.amount).toBe("number");
  }
});

test("search by name only returns matching events", async () => {
  const all = await getEvents("", "");
  if (all.length === 0) return; // nothing in the database to search

  const word = all[0].name.split(" ")[0].toLowerCase();
  const found = await getEvents(word, "");
  expect(found.length).toBeGreaterThan(0);
  for (const event of found) {
    expect(event.name.toLowerCase()).toContain(word);
  }
});

test("search by date only returns events on that date", async () => {
  const all = await getEvents("", "");
  if (all.length === 0) return;

  const found = await getEvents("", all[0].date);
  expect(found.length).toBeGreaterThan(0);
  for (const event of found) {
    expect(event.date).toBe(all[0].date);
  }
});

test("server rejects a wrongly formatted date", async () => {
  await expect(getEvents("", "2026-12-25")).rejects.toThrow("DD/MM/YYYY");
});
