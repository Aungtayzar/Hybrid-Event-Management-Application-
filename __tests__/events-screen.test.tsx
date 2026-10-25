// Feature tests for the Events screen: search and favourites.
// The cloud service is faked here so we control which events come back.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";

import { EventItem, getEvents } from "../src/api";
import Index from "../src/app/index";

// Use the in-memory AsyncStorage that the library provides for tests.
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Replace the real getEvents() with a fake one we control.
jest.mock("../src/api", () => ({ getEvents: jest.fn() }));
const mockGetEvents = getEvents as jest.Mock;

// Replace the native date picker with a fake one: pressing "Choose date" picks mockPickedDate.
let mockPickedDate = new Date();
jest.mock("@react-native-community/datetimepicker", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require("react-native");
  return function FakeDatePicker(props: { onValueChange: (event: object, date: Date) => void }) {
    return <Text onPress={() => props.onValueChange({}, mockPickedDate)}>Choose date</Text>;
  };
});

async function pickDate(date: Date) {
  mockPickedDate = date;
  await fireEvent.press(screen.getByLabelText("Search by date"));
  await fireEvent.press(screen.getByText("Choose date"));
}

function makeEvent(id: string, name: string, date: string): EventItem {
  return {
    id, name, date, location: "Yangon", organiser: "Tester", type: "Workshop",
    status: "Upcoming", amount: 0, description: "", contactEmail: "", contactPhone: "",
  };
}

const musicFestival = makeEvent("dev-1", "Music Festival", "25/12/2026");
const techTalk = makeEvent("dev-2", "Tech Talk", "10/01/2027");

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetEvents.mockReset();
  mockGetEvents.mockResolvedValue([musicFestival, techTalk]);
});

// The star button is the "☆"/"★" text next to each event name.
function starButtons() {
  return screen.queryAllByText(/^[☆★]$/);
}

describe("event list", () => {
  test("shows all events from the cloud when the screen opens", async () => {
    await render(<Index />);

    expect(await screen.findByText("Music Festival")).toBeTruthy();
    expect(screen.getByText("Tech Talk")).toBeTruthy();
    expect(mockGetEvents).toHaveBeenCalledWith("", "");
  });

  test("shows an error when the cloud cannot be reached", async () => {
    mockGetEvents.mockRejectedValue(new Error("Network request failed"));
    await render(<Index />);

    expect(await screen.findByText("Network request failed")).toBeTruthy();
    expect(screen.getByText("No events found.")).toBeTruthy();
  });
});

describe("search", () => {
  test("searches by name as the user types", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    mockGetEvents.mockResolvedValue([musicFestival]);
    await fireEvent.changeText(screen.getByPlaceholderText("Search by name"), "music");

    await waitFor(() => expect(mockGetEvents).toHaveBeenLastCalledWith("music", ""));
    await waitFor(() => expect(screen.queryByText("Tech Talk")).toBeNull());
    expect(screen.getByText("Music Festival")).toBeTruthy();
  });

  test("only searches once after the user stops typing", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");
    mockGetEvents.mockClear();

    const nameBox = screen.getByPlaceholderText("Search by name");
    await fireEvent.changeText(nameBox, "m");
    await fireEvent.changeText(nameBox, "mu");
    await fireEvent.changeText(nameBox, "mus");

    await waitFor(() => expect(mockGetEvents).toHaveBeenCalledWith("mus", ""));
    expect(mockGetEvents).toHaveBeenCalledTimes(1);
  });

  test("searches by date when a date is picked", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    mockGetEvents.mockResolvedValue([techTalk]);
    await pickDate(new Date(2027, 0, 10));

    expect(within(screen.getByLabelText("Search by date")).getByText("📅 10/01/2027")).toBeTruthy();
    await waitFor(() => expect(mockGetEvents).toHaveBeenLastCalledWith("", "10/01/2027"));
    await waitFor(() => expect(screen.queryByText("Music Festival")).toBeNull());
    expect(screen.getByText("Tech Talk")).toBeTruthy();
  });

  test("searches by name and date together", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    await fireEvent.changeText(screen.getByPlaceholderText("Search by name"), "music");
    await pickDate(new Date(2026, 11, 25));

    await waitFor(() => expect(mockGetEvents).toHaveBeenLastCalledWith("music", "25/12/2026"));
  });

  test("shows a message when nothing matches", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    mockGetEvents.mockResolvedValue([]);
    await fireEvent.changeText(screen.getByPlaceholderText("Search by name"), "xyz");

    expect(await screen.findByText("No events found.")).toBeTruthy();
  });

  test("Clear empties the search boxes and shows all events again", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    const nameBox = screen.getByPlaceholderText("Search by name");
    await fireEvent.changeText(nameBox, "music");
    await pickDate(new Date(2026, 11, 25));
    await waitFor(() => expect(mockGetEvents).toHaveBeenLastCalledWith("music", "25/12/2026"));

    await fireEvent.press(screen.getByText("Clear"));

    expect(nameBox.props.value).toBe("");
    expect(within(screen.getByLabelText("Search by date")).getByText("📅 Pick a date")).toBeTruthy();
    await waitFor(() => expect(mockGetEvents).toHaveBeenLastCalledWith("", ""));
  });
});

describe("favourites", () => {
  test("tapping the star adds and removes a favourite", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");
    expect(screen.getByText("★ Favourites (0)")).toBeTruthy();

    await fireEvent.press(starButtons()[0]);
    expect(screen.getByText("★ Favourites (1)")).toBeTruthy();

    await fireEvent.press(starButtons()[0]);
    expect(screen.getByText("★ Favourites (0)")).toBeTruthy();
  });

  test("the Favourites tab only shows favourite events", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    await fireEvent.press(starButtons()[1]); // Tech Talk
    await fireEvent.press(screen.getByText("★ Favourites (1)"));

    expect(screen.getByText("Tech Talk")).toBeTruthy();
    expect(screen.queryByText("Music Festival")).toBeNull();

    await fireEvent.press(screen.getByText("All events"));
    expect(screen.getByText("Music Festival")).toBeTruthy();
  });

  test("favourites are saved on the phone", async () => {
    await render(<Index />);
    await screen.findByText("Music Festival");

    await fireEvent.press(starButtons()[0]);

    expect(JSON.parse((await AsyncStorage.getItem("favourite_event_ids")) ?? "[]")).toEqual(["dev-1"]);
  });

  test("saved favourites are loaded when the app opens again", async () => {
    await AsyncStorage.setItem("favourite_event_ids", JSON.stringify(["dev-2"]));
    await render(<Index />);

    expect(await screen.findByText("★ Favourites (1)")).toBeTruthy();
    await fireEvent.press(screen.getByText("★ Favourites (1)"));
    expect(screen.getByText("Tech Talk")).toBeTruthy();
    expect(screen.queryByText("Music Festival")).toBeNull();
  });
});
