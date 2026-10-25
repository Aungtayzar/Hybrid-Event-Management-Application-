import AsyncStorage from "@react-native-async-storage/async-storage";

// Favourite event ids are saved on the phone, so they are kept after the app closes.
const KEY = "favourite_event_ids";

export async function loadFavourites(): Promise<string[]> {
  const saved = await AsyncStorage.getItem(KEY);
  return saved ? JSON.parse(saved) : [];
}

export async function saveFavourites(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}
