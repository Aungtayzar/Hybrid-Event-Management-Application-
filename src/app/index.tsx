import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EventItem, getEvents } from "../api";
import { loadFavourites, saveFavourites } from "../favourites";

// Turn a Date into the DD/MM/YYYY text the server expects.
function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export default function Index() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  // When the screen opens: load saved favourites.
  useEffect(() => {
    loadFavourites().then(setFavourites);
  }, []);

  // Search the cloud whenever the name or date changes (and once when the screen opens).
  useEffect(() => {
    // On web the date is typed by hand, so wait until it is a full DD/MM/YYYY date.
    if (searchDate !== "" && !/^\d{2}\/\d{2}\/\d{4}$/.test(searchDate)) {
      return;
    }

    // "cancelled" stops an older, slower search from replacing the newest results.
    let cancelled = false;

    // Wait a moment after the last key press so we don't search on every letter.
    // With no search (first load or after Clear) there's nothing to wait for.
    const delay = searchName === "" && searchDate === "" ? 0 : 400;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const found = await getEvents(searchName, searchDate);
        if (!cancelled) setEvents(found);
      } catch (e) {
        if (!cancelled) {
          setEvents([]);
          setError(e instanceof Error ? e.message : "Could not connect to the server.");
        }
      }
      if (!cancelled) setLoading(false);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchName, searchDate]);

  function clearSearch() {
    setSearchName("");
    setSearchDate("");
  }

  // The selected date as a Date object, for the date picker (today if none is chosen).
  function selectedDate() {
    if (searchDate === "") return new Date();
    const [day, month, year] = searchDate.split("/").map(Number);
    return new Date(year, month - 1, day);
  }

  function toggleFavourite(id: string) {
    const updated = favourites.includes(id)
      ? favourites.filter((favId) => favId !== id)
      : [...favourites, id];
    setFavourites(updated);
    saveFavourites(updated);
  }

  const shownEvents = showFavouritesOnly
    ? events.filter((event) => favourites.includes(event.id))
    : events;

  return (
    <View style={styles.container}>
      {/* Search */}
      <TextInput
        style={styles.input}
        placeholder="Search by name"
        value={searchName}
        onChangeText={setSearchName}
      />
      <View style={styles.row}>
        {Platform.OS === "web" ? (
          // The date picker is only available on phones, so on web the date is typed.
          <TextInput
            style={[styles.input, styles.dateBox]}
            placeholder="Date (DD/MM/YYYY)"
            value={searchDate}
            onChangeText={setSearchDate}
          />
        ) : (
          <Pressable
            style={[styles.input, styles.dateBox]}
            accessibilityLabel="Search by date"
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={searchDate === "" && styles.placeholder}>
              📅 {searchDate === "" ? "Pick a date" : searchDate}
            </Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.greyButton]} onPress={clearSearch}>
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
      </View>
      {showDatePicker && (
        <DateTimePicker
          mode="date"
          value={selectedDate()}
          onValueChange={(_event, date) => {
            setShowDatePicker(false);
            setSearchDate(formatDate(date));
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {/* All / Favourites switch */}
      <View style={styles.row}>
        <Pressable
          style={[styles.tab, !showFavouritesOnly && styles.activeTab]}
          onPress={() => setShowFavouritesOnly(false)}
        >
          <Text>All events</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, showFavouritesOnly && styles.activeTab]}
          onPress={() => setShowFavouritesOnly(true)}
        >
          <Text>★ Favourites ({favourites.length})</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator size="large" />}
      {error !== "" && <Text style={styles.error}>{error}</Text>}

      {/* Event list */}
      <FlatList
        data={shownEvents}
        keyExtractor={(event) => event.id}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No events found.</Text> : undefined}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>
              <Pressable onPress={() => toggleFavourite(item.id)}>
                <Text style={styles.star}>{favourites.includes(item.id) ? "★" : "☆"}</Text>
              </Pressable>
            </View>
            <Text>📅 {item.date}</Text>
            <Text>📍 {item.location}</Text>
            <Text>Organiser: {item.organiser}</Text>
            <Text>
              {item.type} · {item.status} · {item.amount.toFixed(2)}
            </Text>
            {item.description !== "" && <Text style={styles.description}>{item.description}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: "#f2f2f2" },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  dateBox: { flex: 1, marginBottom: 0, justifyContent: "center" },
  placeholder: { color: "#888" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center" },
  greyButton: { backgroundColor: "#6b7280" },
  buttonText: { color: "white", fontWeight: "bold" },
  tab: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#e5e7eb" },
  activeTab: { backgroundColor: "#bfdbfe" },
  error: { color: "red", marginBottom: 8 },
  empty: { textAlign: "center", marginTop: 20, color: "#666" },
  card: { backgroundColor: "white", padding: 12, borderRadius: 8, marginBottom: 8, gap: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 18, fontWeight: "bold", flex: 1 },
  star: { fontSize: 28, color: "#f59e0b" },
  description: { color: "#555", marginTop: 4 },
});
