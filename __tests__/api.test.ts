// Unit tests for src/api.ts. The server is faked, so these run without Laragon.
import { API_URL, getEvents } from "../src/api";

// Makes fetch() return this JSON, then returns the mock so we can check how it was called.
function fakeServerResponse(json: object) {
  const mockFetch = jest.fn().mockResolvedValue({ json: async () => json });
  global.fetch = mockFetch;
  return mockFetch;
}

function calledUrl(mockFetch: jest.Mock): string {
  return mockFetch.mock.calls[0][0];
}

test("uses localhost when not running through Expo", () => {
  expect(API_URL).toBe("http://localhost/eventmanagementapi");
});

test("asks for all events when the search is empty", async () => {
  const mockFetch = fakeServerResponse({ success: true, events: [] });
  await getEvents("", "");
  expect(calledUrl(mockFetch)).toBe(`${API_URL}/getevents.php?`);
});

test("sends the name and date search to the server", async () => {
  const mockFetch = fakeServerResponse({ success: true, events: [] });
  await getEvents("  music ", "25/12/2026");
  expect(calledUrl(mockFetch)).toBe(`${API_URL}/getevents.php?name=music&date=25%2F12%2F2026`);
});

test("returns the events from the server", async () => {
  const event = { id: "abc-1", name: "Music Festival", date: "25/12/2026" };
  fakeServerResponse({ success: true, events: [event] });
  expect(await getEvents("", "")).toEqual([event]);
});

test("shows the server's error message", async () => {
  fakeServerResponse({ success: false, error: { message: "date must be in DD/MM/YYYY format." } });
  await expect(getEvents("", "bad")).rejects.toThrow("date must be in DD/MM/YYYY format.");
});

test("fails when the server cannot be reached", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));
  await expect(getEvents("", "")).rejects.toThrow("Network request failed");
});
