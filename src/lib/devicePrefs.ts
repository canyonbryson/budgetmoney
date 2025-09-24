import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hasSeenLandingPage:v1";

export const get = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(KEY)) === "true";
  } catch {
    return false;
  }
};

export const set = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, "true");
  } catch {
    // noop
  }
};


