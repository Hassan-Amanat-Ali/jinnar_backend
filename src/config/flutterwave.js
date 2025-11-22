// config/flutterwave.js
// Safe to import early: ensure dotenv is loaded so process.env values are available
import dotenv from "dotenv";
dotenv.config();
import Flutterwave from "flutterwave-node-v3";

const pub = process.env.FLW_PUBLIC_KEY;
const sec = process.env.FLW_SECRET_KEY;

if (!pub || !sec) {
  console.warn(
    "Warning: Flutterwave keys are missing. Check .env for FLW_PUBLIC_KEY and FLW_SECRET_KEY",
  );
}

console.log("Flutterwave keys loaded (publicKey present?):", Boolean(pub));

const flw = new Flutterwave(pub, sec);

export default flw;
