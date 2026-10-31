# Shiprocket setup guide (Aadya / Tushaqsa)

For the store owner. Follow in order. Nothing here creates a real shipment until you press the final button on a real order.

> Status: the package, serviceability and shipment-creation code is merged to `main` (PR #75) but is **not deployed to production yet**. Steps 1 to 3 can be done in Shiprocket right now. Steps 4 onward need the deploy.

## What you need before you start

| Item | Where it comes from |
|---|---|
| A Shiprocket account with KYC done and wallet balance | shiprocket.in |
| A separate **API user** (email + password) | Step 1 |
| A registered **pickup address** | Step 2 |
| Your pickup address details: contact name, phone, full address, city, state, 6-digit pincode | You |
| Admin login for the Aadya store (SUPER_ADMIN role) | You |

## Step 1. Create the API user (not your normal login)

The Shiprocket API does not accept your normal login. It needs a dedicated API user.

1. Log in to Shiprocket.
2. Go to **Settings → API → Configure → Create an API User**.
3. Use an email address that is **different** from your main Shiprocket login (a spare Gmail or a store alias works).
4. Set a password. Save the email and password somewhere safe.

Never paste this password into chat, email or the code. It only goes into the admin page in Step 4.

## Step 2. Register the pickup address

1. In Shiprocket go to **Settings → Pickup Addresses → Add**.
2. Fill in contact name, phone, address, city, state and pincode.
3. Note the **nickname** (for example `Primary`). It must match exactly in Step 5.

## Step 3. Enter product shipping data (Admin)

Each product has a new section, **Shipping & Package Details**:

- Dead weight in kg
- Package length, width and height in cm

These are separate from the customer-facing "Dimensions" text and are the only values used for courier maths. You can leave them empty while drafting, but an order cannot be shipped by Shiprocket until the package is confirmed (Step 7).

## Step 4. Connect the API user (Admin → Integrations → Shiprocket)

1. Enter the API user email and password from Step 1.
2. Leave **API base URL** empty.
3. Save, then press **Test connection**. This only logs in. It does not create anything.
4. The password is stored encrypted and is never shown again.

## Step 5. Turn the provider on (Admin → Shipping)

1. **Provider:** SHIPROCKET.
2. **Environment:** start with TEST.
3. **Pickup location:** the nickname from Step 2 plus name, phone, address, city, state and a valid 6-digit postal code.
4. **Packaging weight:** grams added to every package for the box and filler (set your real number; it is not hardcoded).
5. **Package presets (optional):** for example Small Box, Medium Box.
6. Leave **auto-create shipment**, **auto-AWB** and **auto-pickup** switched **off** until you have handled one order by hand.
7. Save.

## Step 6. Tracking webhook (Admin → Integrations → Shiprocket)

1. Press **Generate token**. It is shown once. Copy it.
2. In Shiprocket go to **Settings → API → Webhooks** and add a webhook.
3. **URL:** the URL shown on the Integrations page, exactly as shown (Shiprocket rejects URLs containing "shiprocket", "sr" or "kr", and the shown URL avoids them).
4. **Security Token:** paste the token. Shiprocket sends it in the `x-api-key` header.
5. Switch the webhook on and save.
6. The Integrations page shows "Last webhook" once Shiprocket has sent something.

## Step 7. Handle an order (Admin → Orders → open order)

1. The **Ship with Shiprocket · Package** card shows the items, their weights and sizes, and a suggested package.
2. Edit weight and dimensions if the real box is different, or pick a preset.
3. Press **Confirm Package & Check Couriers**. Your values are saved with the order as a snapshot.
4. Choose a courier from the list (rate, delivery estimate, COD, rating). The recommended one is marked.
5. Press **Create Shiprocket shipment**. This creates a **real** Shiprocket order and assigns the courier (AWB). Do this only on a real order you intend to ship.
6. Use **Schedule Pickup**, **Download Label** and **Refresh Tracking** in the Provider Shipment card.

How the package is suggested:

| Order | Suggestion |
|---|---|
| One item, one unit | That item's own box |
| Several units of one item | Same footprint, height multiplied by the quantity (flagged for review) |
| Mixed items | Conservative estimate with everything stacked flat (flagged for review) |
| Any item missing data | No dimensions suggested; you enter them |

Weight is always item weights plus your packaging weight. Volumetric weight is shown as an estimate only; the courier's chargeable weight is what is billed.

## Payment mapping

- Paid online (Cashfree) is sent as **Prepaid**.
- Cash on delivery is sent as **COD**, and only COD-capable couriers are listed.

## Safety rules built in

- No Shiprocket shipment is created, manually or automatically, without a confirmed package.
- Once a shipment exists the package is locked. Editing the product later does not change it.
- A second "create" on the same order is refused, so a double-click or retry cannot duplicate the Shiprocket order.
- Provider errors are shown in a safe, short form. Secrets are never displayed.

## Known limits (read before going live)

1. The Shiprocket endpoints and response fields were implemented from the documented external API but have **not** been checked against a live or sandbox account yet. The first real call is the verification.
2. The status-ID table that maps Shiprocket tracking statuses to order states predates this work and must be checked against the first real webhook payloads. Unknown statuses change nothing and email nobody.
3. Not yet built: customer-facing tracking timeline redesign, admin alerts for failed shipments, Shiprocket-side cancellation, return (reverse) shipments, label/manifest polish, and a fuller Integrations diagnostics page.
4. Variants have no admin screen in this codebase; variant shipping values can only be set through the API. Variants inherit the product's values.

## First-order checklist

- [ ] API user created, credentials saved in Admin → Integrations, Test connection OK
- [ ] Pickup address registered; nickname matches Admin → Shipping
- [ ] Webhook added with the token; "Last webhook" updates after a test event
- [ ] Product weights and sizes entered for your top products
- [ ] One real order: confirm package, check couriers, create shipment, schedule pickup, watch tracking
- [ ] Only then consider turning on auto-AWB and auto-pickup

## If something fails

| Message | Likely cause |
|---|---|
| "SHIPROCKET is not configured" | API user email/password not saved in Integrations |
| "Pickup location is incomplete" | Missing field in Admin → Shipping pickup section |
| "Set a valid 6-digit pickup postal code" | Pickup pincode empty or wrong |
| "Confirm the package" | Press Confirm Package first (Step 7) |
| No couriers listed | Pincode not serviceable for that package/COD; adjust the package or contact Shiprocket |
| Webhook shows nothing | Token mismatch, or webhook not switched on in Shiprocket |
