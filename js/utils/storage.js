export function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
export function load(key, defaultValue = []) {
  try {
    const text = localStorage.getItem(key);
    if (text === null) return defaultValue;
    return JSON.parse(text);
  } catch (error) {
    return defaultValue;
  }
}
