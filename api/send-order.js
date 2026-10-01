const { Resend } = require("resend");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Klubbera order email",
      ready: Boolean(
        process.env.RESEND_API_KEY && process.env.FROM_EMAIL
      )
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const { customer, items, total, orderNumber } = req.body || {};

    if (
      !customer?.name ||
      !customer?.email ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return res.status(400).json({
        ok: false,
        error: "Missing order information"
      });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "RESEND_API_KEY is missing"
      });
    }

    if (!process.env.FROM_EMAIL) {
      return res.status(500).json({
        ok: false,
        error: "FROM_EMAIL is missing"
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const rows = items.map((item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee">
          <strong>${escapeHtml(item.name)}</strong>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center">
          ${Number(item.qty) || 0}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right">
          ${formatSek((Number(item.price) || 0) * (Number(item.qty) || 0))}
        </td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto">
        <h1 style="color:#ff5a1f">KLUBBERA</h1>

        <h2>Tack för din testorder!</h2>

        <p>Hej ${escapeHtml(customer.name)},</p>

        <p>
          Detta är en <strong>testorder</strong> från Klubberas prototyp.
          Ingen betalning eller riktig leverans har genomförts.
        </p>

        <p>
          <strong>Ordernummer:</strong>
          ${escapeHtml(orderNumber || "KL-DEMO")}
        </p>

        <table style="width:100%;border-collapse:collapse">
          <tbody>${rows}</tbody>
        </table>

        <h3 style="text-align:right">
          Total: ${formatSek(total)}
        </h3>

        <p>
          ${escapeHtml(customer.address || "")}
        </p>

        <p>
          ${escapeHtml(customer.email)}
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: [customer.email],
      subject: `Klubbera testorder ${orderNumber || ""}`.trim(),
      html
    });

    if (result.error) {
      console.error("RESEND ERROR:", result.error);

      return res.status(502).json({
        ok: false,
        error: result.error.message || "Resend API error"
      });
    }

    return res.status(200).json({
      ok: true,
      id: result.data?.id || null
    });

  } catch (error) {
    console.error("SEND ORDER ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || String(error)
    });
  }
};

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
