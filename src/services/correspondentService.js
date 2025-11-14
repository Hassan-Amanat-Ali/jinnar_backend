import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/pawapayCorrespondents.json"), "utf8")
);

export function getSupportedProviders() {
  const deposit = [];
  const payout = [];

  for (const entry of rawData) {
    const country = entry.country;

    for (const corr of entry.correspondents) {
      const allowsDeposit = corr.operationTypes.some(
        op => op.operationType === "DEPOSIT" && op.status === "OPERATIONAL"
      );

      const allowsPayout = corr.operationTypes.some(
        op => op.operationType === "PAYOUT" && op.status === "OPERATIONAL"
      );

      if (allowsDeposit) deposit.push({
        country,
        correspondent: corr.correspondent
      });

      if (allowsPayout) payout.push({
        country,
        correspondent: corr.correspondent
      });
    }
  }

  return { deposit, payout };
}
