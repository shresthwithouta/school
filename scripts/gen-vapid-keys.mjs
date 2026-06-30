// Generates a VAPID key pair for Web Push and prints the env lines to paste
// into .env.local. Run once per environment:  node scripts/gen-vapid-keys.mjs
//
// VAPID keys identify *your server* to the browser's push service. Keep the
// private key secret; rotating it invalidates every existing subscription.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("# Add these to .env.local (and the public key to your host's env):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:admin@school.edu"`);
