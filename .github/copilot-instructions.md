## Repo orientation — quick summary

- This is a Node.js + Express REST API (ESM modules). Entry point: `src/index.js`.
- MongoDB with Mongoose is used; DB connection code in `src/config/db.js` (env: `MONGO_URI`).
- Routes are registered under `src/routes/*.js` and implemented in `src/controllers/*.js`.
- Models live in `src/models/*.js` and use Mongoose schemas (see `src/models/User.js` for wallet/transaction shape).

## Key architectural patterns

- Route -> Controller -> Model: controllers handle request validation, business logic, and persist with Mongoose. Example: `src/controllers/userController.js`.
- Auth: JWT-based. Middleware `src/middleware/auth.js` expects `Authorization: Bearer <token>` and sets `req.user = { id, role }`.
- File uploads: `src/middleware/upload.js` uses `multer`, `sharp`, and `fluent-ffmpeg`. It auto-creates `temp/` and `uploads/*` directories and exports helpers `uploadFiles` (fields) and `uploadGigImage` (single).
- Error handling: `src/middleware/errorHandler.js` is currently a NO-OP (commented out). Many controllers perform try/catch and return JSON errors directly — prefer following existing controller patterns when adding features.

## Environment & runtime notes

- Project uses ESM (`"type": "module"` in `package.json`). Use import/export, not require.
- Important env variables: `PORT`, `MONGO_URI`, `JWT_SECRET`, and (for payments) `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_ENCRYPTION_KEY`.
- FFmpeg is required for video processing. `src/middleware/upload.js` runs `which ffmpeg` and falls back to `/usr/local/bin/ffmpeg`. Ensure FFmpeg is installed on the developer machine or CI.

## Developer commands (from `package.json`)

- Start (prod): `npm run start` -> `node src/index.js`
- Dev with auto-reload: `npm run dev` (nodemon)
- Lint: `npm run lint` (eslint)
- Format: `npm run format` (prettier)
- Validate swagger spec: `npm run validate-swagger` (uses `src/config/swagger.yaml`)

## Project-specific conventions & gotchas

- Mobile numbers must be E.164 (see `src/models/User.js` regex). Controllers assume `user.mobileNumber` is validated.
- Many endpoints accept certain array fields as JSON strings (frontend may send stringified JSON). Check `userController.js` where fields like `skills`, `videos`, `portfolioImages` are parsed with `JSON.parse` if they are strings — follow that parsing pattern when adding endpoints that accept complex fields.
- Wallet and transactions live in the `wallet` subdocument of `User`. Transactions use enums: `['deposit','withdrawal','order_payment','order_earned','refund']` and payment methods `['mpesa','airtel_money','tigo_pesa','flutterwave_card','bank_transfer']` (see `src/models/User.js` and `src/controllers/walletController.js`). When changing transaction logic, update both controller code and the schema enums.
- Responses are JSON. Controllers generally return status codes and JSON error objects; match existing structure for consistency.

## Integration points & external services

- Payments: `src/controllers/walletController.js` integrates (or plans to) with Flutterwave, M-Pesa, Airtel, Tigo. Many functions are placeholders — check TODOs before changing payment flows.
- Swagger: API spec in `src/config/swagger.yaml` is served at `/api-docs` and validated by the `validate-swagger` script.

## Quick examples (where to look)

- Protect route with JWT: see `src/middleware/auth.js` and how controllers read `req.user.id` (e.g. `userController.updateUser`).
- Upload images/videos/certificates: use `uploadFiles` from `src/middleware/upload.js` (fields: `portfolioImages`, `videos`, `certificates`). `uploadGigImage` handles a single `gigImage` upload.
- Wallet flow example: `src/controllers/walletController.js` demonstrates creating a transaction record, setting `status` to `pending`, and only applying balance changes when `status === 'completed'`.

## When editing code

- Keep ESM import style. Respect existing error/response shapes. Add unit tests where feasible, but note this repo currently has no test runner set up.
- If you add new environment variables, document them in `README.md` (or a new `.env.example`).

## Questions & missing details to ask the human

- Which Node versions / CI images should be targeted? (ESM requires Node >=12; recommend Node 18+)
- Payment provider credentials and webhooks: provide test keys and webhook endpoints to complete the wallet flows.
- Expected behavior for the global error handler: should it be enabled and standardized, or keep controller-level handling?

If any section is unclear or you'd like examples expanded (e.g., a sample request body for `updateUser` or exact env examples), tell me which parts to expand and I'll update this file.
