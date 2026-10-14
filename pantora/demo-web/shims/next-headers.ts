// next/headers replacement. The hosted demo keeps its "cookies" in memory and
// mirrors them to localStorage so a reload keeps you signed in.

const KEY = "pantora-demo-cookies";
const jar = new Map<string, string>();

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  for (const [k, v] of Object.entries(saved)) jar.set(k, v);
} catch {
  /* storage unavailable: session-only */
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(jar)));
  } catch {
    /* storage unavailable */
  }
}

const store = {
  get(name: string) {
    const value = jar.get(name);
    return value === undefined ? undefined : { name, value };
  },
  has(name: string) {
    return jar.has(name);
  },
  set(name: string, value: string) {
    jar.set(name, value);
    persist();
  },
  delete(name: string) {
    jar.delete(name);
    persist();
  },
};

export async function cookies() {
  return store;
}

export async function headers() {
  return new Headers();
}
