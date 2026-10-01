const { Resend } = require("resend");

module.exports = async function handler(req, res) {
  // CORS: allow the standalone Klubbera test shop to call this Vercel function.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Browsers send a preflight request before the JSON POST.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { customer, items, total, orderNumber } = req.body || {};

    if (!customer?.name || !customer?.email || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: "Missing order information" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const rows = items.map((item) => {
      const options = [
        item.options?.team ? `Lag: ${escapeHtml(item.options.team)}` : "",
        item.options?.number ? `Bollnummer: #${escapeHtml(item.options.number)}` : ""
      ].filter(Boolean).join(" · ");

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(item.name)}</strong>
            ${options ? `<div style="font-size:13px;color:#666;margin-top:4px">${options}</div>` : ""}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
          <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right">${formatSek(item.price * item.qty)}</td>
        </tr>`;
    }).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#111">
        <h1 style="color:#ff5a1f">Klubbera</h1>
        <h2>Tack för din testorder!</h2>
        <p>Hej ${escapeHtml(customer.name)},</p>
        <p>Det här är en <strong>testorder</strong> från Klubbera. Ingen betalning eller riktig leverans har genomförts.</p>
        <p><strong>Ordernummer:</strong> ${escapeHtml(orderNumber || "KL-DEMO")}</p>

        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding-bottom:8px">Produkt</th>
              <th style="padding-bottom:8px">Antal</th>
              <th style="text-align:right;padding-bottom:8px">Pris</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <h3 style="text-align:right">Total: ${formatSek(total)}</h3>

        <div style="background:#f7f7f5;border-radius:12px;padding:16px;margin-top:20px">
          <strong>Leveransuppgifter</strong><br>
          ${escapeHtml(customer.name)}<br>
          ${escapeHtml(customer.address)}<br>
          ${escapeHtml(customer.email)}
        </div>

        <p style="color:#777;font-size:12px;margin-top:25px">
          Detta mejl skapades av Klubberas testbutik. Det är inte en riktig orderbekräftelse.
        </p>
      </div>`;

    // During initial testing, send to the same address entered in the checkout.
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: [customer.email],
      subject: `Klubbera testorder ${orderNumber || ""}`.trim(),
      html
    });

    if (result.error) {
      return res.status(500).json({ ok: false, error: result.error.message || "Resend error" });
    }

    return res.status(200).json({ ok: true, id: result.data?.id });
 } catch (error) {
  console.error("RESEND ERROR:", error);

  return res.status(500).json({
    ok: false,
    error: error?.message || String(error)
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSek(value) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK"
  }).format(Number(value) || 0);
}
