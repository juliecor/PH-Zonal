/**
 * app/api/send-email/route.ts
 *
 * Receives a small JSON POST — property data only, NO PDF binary.
 * The PDF is handled client-side (auto-downloaded after send succeeds).
 * This keeps the payload well under Next.js's 4 MB body-size limit.
 *
 * Expected POST body:
 * {
 *   receiverName:  string
 *   receiverEmail: string
 *   message?:      string   (optional personal note)
 *   propertyTitle: string
 *   pdfFilename?:  string
 *   propertyData:  {
 *     street, barangay, city, province, classification,
 *     zonalValue, areaDescription, idealBusinessText,
 *     poiCounts: Record<string,number> | null
 *   }
 * }
 *
 * ─── HOW TO ACTIVATE ────────────────────────────────────────────────────────
 * Uncomment ONE provider block, install its package, set the env vars.
 *
 * Recommended for Vercel / cloud : Resend     (npm install resend)
 * Recommended for self-hosted    : Nodemailer (npm install nodemailer)
 * ────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";

// ─── HTML email builder ───────────────────────────────────────────────────────
function buildHtml(p: {
  receiverName: string;
  message: string;
  propertyTitle: string;
  propertyData: Record<string, any>;
}): string {
  const { receiverName, message, propertyTitle, propertyData: pd } = p;

  const row = (label: string, value: string, shaded = false) =>
    value
      ? `<tr${shaded ? ' style="background:#f0f9ff"' : ""}>
           <td style="padding:8px 20px;color:#6b7280;font-size:13px;width:40%">${label}</td>
           <td style="padding:8px 20px;color:#111827;font-size:13px;font-weight:600">${value}</td>
         </tr>`
      : "";

  const poiRows = pd.poiCounts
    ? Object.entries(pd.poiCounts as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(
          ([k, v]) =>
            `<tr>
               <td style="padding:4px 8px;color:#555;text-transform:capitalize">
                 ${k.replace(/([A-Z])/g, " $1").trim()}
               </td>
               <td style="padding:4px 8px;font-weight:bold;color:#1d4ed8">${v}</td>
             </tr>`
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(0,0,0,.08);">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);
                     padding:32px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px">&#127960;&#65039;</div>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">
          Property Report
        </h1>
        <p style="margin:8px 0 0;color:#bfdbfe;font-size:13px">${propertyTitle}</p>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:28px 32px 0">
        <p style="margin:0;font-size:15px;color:#374151">
          Hello <strong>${receiverName}</strong>,
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6">
          You have received a property report via
          <strong>ZonalValue by Filipino Homes</strong>.
        </p>
        ${
          message
            ? `<div style="margin:16px 0 0;padding:16px;background:#eff6ff;
                           border-left:4px solid #2563eb;border-radius:8px;
                           font-size:14px;color:#1e40af;line-height:1.6">
                 &ldquo;${message}&rdquo;
               </div>`
            : ""
        }
      </td></tr>

      <!-- Property details -->
      <tr><td style="padding:24px 32px 0">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;
                    border-radius:12px;overflow:hidden">
          <div style="background:#2563eb;padding:12px 20px">
            <span style="color:#fff;font-size:13px;font-weight:700;
                         text-transform:uppercase;letter-spacing:.05em">
              &#128205; Property Details
            </span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:4px 0">
            ${row("Street / Subdivision", pd.street        || "")}
            ${row("Barangay",             pd.barangay      || "", true)}
            ${row("City",                 pd.city          || "")}
            ${row("Province",             pd.province      || "", true)}
            ${row("Classification",       pd.classification|| "")}
          </table>
        </div>
      </td></tr>

      <!-- Zonal value -->
      ${pd.zonalValue ? `
      <tr><td style="padding:20px 32px 0">
        <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);
                    border-radius:12px;padding:20px;text-align:center">
          <div style="color:#bfdbfe;font-size:11px;font-weight:700;
                      text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">
            &#128176; BIR Zonal Value
          </div>
          <div style="color:#fff;font-size:32px;font-weight:900;line-height:1">
            &#8369;${pd.zonalValue}
          </div>
          <div style="color:#bfdbfe;font-size:12px;font-weight:600;margin-top:6px">
            per square meter
          </div>
        </div>
      </td></tr>` : ""}

      <!-- Area description -->
      ${pd.areaDescription ? `
      <tr><td style="padding:20px 32px 0">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;
                    border-radius:12px;padding:16px 20px">
          <div style="font-size:12px;font-weight:700;color:#374151;
                      text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
            &#128203; Area Overview
          </div>
          <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.7;
                    white-space:pre-line">${pd.areaDescription}</p>
        </div>
      </td></tr>` : ""}

      <!-- POI counts -->
      ${poiRows ? `
      <tr><td style="padding:20px 32px 0">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;
                    border-radius:12px;overflow:hidden">
          <div style="background:#16a34a;padding:12px 20px">
            <span style="color:#fff;font-size:13px;font-weight:700;
                         text-transform:uppercase;letter-spacing:.05em">
              &#127962; Nearby Facilities
            </span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="padding:4px 0">${poiRows}</table>
        </div>
      </td></tr>` : ""}

      <!-- Business recommendations -->
      ${pd.idealBusinessText ? `
      <tr><td style="padding:20px 32px 0">
        <div style="background:#fefce8;border:1px solid #fde68a;
                    border-radius:12px;padding:16px 20px">
          <div style="font-size:12px;font-weight:700;color:#92400e;
                      text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
            &#128161; Business Recommendations
          </div>
          <p style="margin:0;font-size:13px;color:#78350f;line-height:1.7;
                    white-space:pre-line">${pd.idealBusinessText}</p>
        </div>
      </td></tr>` : ""}

      <!-- PDF download note -->
      <tr><td style="padding:20px 32px 0">
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;
                    border-radius:12px;padding:16px 20px;display:flex;
                    align-items:center;gap:12px">
          <span style="font-size:22px">&#128196;</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#4c1d95">
              PDF Report Available
            </div>
            <div style="font-size:12px;color:#7c3aed;margin-top:2px">
              A full PDF copy of this report has been generated and
              downloaded to the sender&rsquo;s device.
            </div>
          </div>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 32px">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;
                  text-align:center;border-top:1px solid #e5e7eb;padding-top:16px">
          The Zonal Value information is for informational purposes only and is
          not an official appraisal. For official valuations please consult a
          licensed appraiser or the BIR.
        </p>
        <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;text-align:center">
          Sent via <strong style="color:#2563eb">ZonalValue</strong>
          by Filipino Homes &nbsp;&middot;&nbsp;
          <a href="https://filipinohomes.com"
             style="color:#2563eb;text-decoration:none">filipinohomes.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── Small JSON payload only — no PDF binary, no size-limit issues ──────
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch (err: any) {
      console.error("[send-email] JSON parse error:", err?.message);
      return NextResponse.json(
        { ok: false, error: "Invalid request. Please try again." },
        { status: 400 }
      );
    }

    const {
      receiverName  = "",
      receiverEmail = "",
      message       = "",
      propertyTitle = "Property Report",
      pdfFilename   = "zonal-report.pdf",
      propertyData  = {},
    } = body;

    // ── Validate ─────────────────────────────────────────────────────────────
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!String(receiverName).trim())
      return NextResponse.json(
        { ok: false, error: "Receiver name is required." },
        { status: 400 }
      );
    if (!String(receiverEmail).trim() || !emailRe.test(String(receiverEmail)))
      return NextResponse.json(
        { ok: false, error: "Valid receiver email is required." },
        { status: 400 }
      );

    const html    = buildHtml({ receiverName, message, propertyTitle, propertyData });
    const subject = `Property Report: ${propertyTitle}`;

    // ══════════════════════════════════════════════════════════════════════════
    // OPTION A — Resend  (recommended for Vercel / cloud)
    // npm install resend
    // Env vars: RESEND_API_KEY   RESEND_FROM (e.g. noreply@yourdomain.com)
    // ══════════════════════════════════════════════════════════════════════════
    /*
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from:    `ZonalValue by Filipino Homes <${process.env.RESEND_FROM}>`,
      to:      [receiverEmail],
      subject,
      html,
    });
    */

    // ══════════════════════════════════════════════════════════════════════════
    // OPTION B — Nodemailer  (recommended for self-hosted / VPS)
    // npm install nodemailer   &&   npm install -D @types/nodemailer
    // Env vars: SMTP_HOST  SMTP_PORT  SMTP_SECURE  SMTP_USER  SMTP_PASS  SMTP_FROM
    // ══════════════════════════════════════════════════════════════════════════
    /*
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST!,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:   { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    });
    await transporter.sendMail({
      from:    `"ZonalValue by Filipino Homes" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to:      `${receiverName} <${receiverEmail}>`,
      subject,
      html,
    });
    */

    // ══════════════════════════════════════════════════════════════════════════
    // OPTION C — SendGrid
    // npm install @sendgrid/mail
    // Env vars: SENDGRID_API_KEY   SENDGRID_FROM
    // ══════════════════════════════════════════════════════════════════════════
    /*
    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    await sgMail.send({
      from:    { email: process.env.SENDGRID_FROM!, name: "ZonalValue by Filipino Homes" },
      to:      receiverEmail,
      subject,
      html,
    });
    */

    // ══════════════════════════════════════════════════════════════════════════
    // DEV PLACEHOLDER — remove this block once you uncomment a real provider
    // ══════════════════════════════════════════════════════════════════════════
    console.log("[send-email] ── DEV MODE ─────────────────────────────────────");
    console.log(`  To:      ${receiverName} <${receiverEmail}>`);
    console.log(`  Subject: ${subject}`);
    console.log("[send-email] ──────────────────────────────────────────────────");
    await new Promise((r) => setTimeout(r, 800));

    return NextResponse.json({ ok: true, message: "Report sent successfully." });
  } catch (err: any) {
    console.error("[send-email] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to send email. Please try again." },
      { status: 500 }
    );
  }
}