import * as SecureStore from "expo-secure-store";

export const setCache = (key: string, value: string) => {
  SecureStore.setItem(key, value);
};

export const getCache = (key: string) => {
  return SecureStore.getItem(key);
};

export const removeCache = (key: string) => {
  SecureStore.deleteItemAsync(key);
};
