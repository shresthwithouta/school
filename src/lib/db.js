import mongoose from "mongoose";
import dns from "dns";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Add it to .env.local."
  );
}

// Quieter Mongoose: opt into the modern return-document behaviour.
mongoose.set("strictQuery", true);

/**
 * `mongodb+srv://` needs an SRV DNS lookup. Some local/ISP resolvers refuse SRV
 * queries (ECONNREFUSED), which breaks the connection. Route DNS through public
 * resolvers (plus the system ones as fallback) so Atlas SRV records resolve.
 */
if (MONGODB_URI.startsWith("mongodb+srv")) {
  try {
    const system = dns.getServers();
    dns.setServers([...new Set(["8.8.8.8", "1.1.1.1", ...system])]);
  } catch {
    // ignore — fall back to system resolver
  }
}

/**
 * Cache the connection (and in-flight promise) on the Node global so Next.js
 * hot reloads don't open a new connection on every change.
 */









const cached = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

async function connectWithRetry(attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await mongoose.connect(MONGODB_URI , {
        bufferCommands: false,
        serverSelectionTimeoutMS: 20000,
      });
    } catch (err) {
      lastErr = err;
      // Flaky SRV/DNS lookups often succeed on a quick retry.
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = connectWithRetry();
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

/** Strip Mongo-internal fields from a lean document. */
export function stripMongo(doc) {
  const { _id, __v, ...rest } = doc;
  void _id;
  void __v;
  return rest ;
}
