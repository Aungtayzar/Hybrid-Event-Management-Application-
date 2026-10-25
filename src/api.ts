import Constants from "expo-constants";

// Address of the PHP cloud service (the same one the Android admin app uploads to).
// While developing, Expo already knows your PC's address (the one in the QR code,
// e.g. 192.168.0.102:8081), so we reuse it. This works on the emulator and on a real
// phone on the same Wi-Fi. On the web or in tests it falls back to "localhost".
// For a real cloud host, replace this with its URL, e.g. "https://myhost.com/eventmanagementapi".
const pcAddress = Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
export const API_URL = `http://${pcAddress}/eventmanagementapi`;

export type EventItem = {
  id: string;
  name: string;
  date: string; // DD/MM/YYYY
  location: string;
  organiser: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  contactEmail: string;
  contactPhone: string;
};

// Gets events from the cloud. Leave name/date empty to get every event.
export async function getEvents(name: string, date: string): Promise<EventItem[]> {
  const query = new URLSearchParams();
  if (name.trim() !== "") query.append("name", name.trim());
  if (date.trim() !== "") query.append("date", date.trim());

  // Give up after 10 seconds instead of loading forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/getevents.php?${query.toString()}`, {
      signal: controller.signal,
    });
    const json = await response.json();

    if (!json.success) {
      throw new Error(json.error?.message ?? "Could not load events.");
    }
    return json.events;
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`Server did not answer. Is Laragon running? (${API_URL})`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
