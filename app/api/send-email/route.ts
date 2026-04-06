/**
 * app/api/send-email/route.ts
 *
<<<<<<< HEAD
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
 *     poiCounts: Record<string,number | null
 *   }
 * }
 *
 * ─── HOW TO ACTIVATE ────────────────────────────────────────────────────────
 * Uncomment ONE provider block, install its package, set the env vars.
 *
 * Recommended for Vercel / cloud : Resend     (npm install resend)
 * Recommended for self-hosted    : Nodemailer (npm install nodemailer)
 * ────────────────────────────────────────────────────────────────────────────
 HEAD
=======
 * Clean version - PDF attached properly + reliable "View PDF" button
>>>>>>> d3a21fb (update email)
 */

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ─── HTML email builder (Simplified & Fixed) ───────────────────────────────
function buildHtml(p: {
  receiverName: string;
  message: string;
  propertyTitle: string;
  pdfFilename: string;
}): string {
  const { receiverName, message, propertyTitle, pdfFilename } = p;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Property Report</title>
  <style>
    .pdf-button {
      display: inline-block;
      background: #1e40af;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      margin: 10px 0;
      transition: background 0.3s ease;
    }
    .pdf-button:hover {
      background: #1e3a8a;
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Blue Header -->
        <tr>
          <td style="background:#1e40af;padding:30px 40px;text-align:center;">
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:28px;">📍</span>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                FILIPINO HOMES
              </h1>
            </div>
            <p style="margin:0;color:#bfdbfe;font-size:13px;font-weight:500;">
              BUY • SELL • RENT • FORECLOSURE
            </p>
            <div style="margin-top:20px;">
              <h2 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                Property Report
              </h2>
              <p style="margin:8px 0 0;color:#dbeafe;font-size:15px;">
                ${propertyTitle}
              </p>
            </div>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:40px 40px 30px;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;">
              Hello <strong>${receiverName}</strong>,
            </p>
            
            <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.7;">
              You have received a property report via 
              <strong style="color:#1e40af;">Filipino Homes by ZonalValue</strong>.
            </p>
            
            <p style="margin:20px 0 0;font-size:15px;color:#4b5563;line-height:1.7;">
              The full PDF report is attached to this email.
            </p>

            ${
              message
                ? `<div style="margin:24px 0;padding:18px;background:#f0f9ff;border-left:5px solid #3b82f6;border-radius:6px;font-size:14.5px;color:#1e40af;">
                     <strong>Message:</strong><br/>"${message}"
                   </div>`
                : ""
            }
          </td>
        </tr>

        <!-- View PDF Button only — no duplicate card below -->
        <tr>
          <td style="padding:0 40px 40px;text-align:center;">
            <a href="cid:${pdfFilename}" class="pdf-button">
              📄 Open PDF Report
            </a>
            <p style="margin:15px 0 0;font-size:13px;color:#64748b;">
              Click the button above or open the attached file <strong>${pdfFilename}</strong> to view the full report.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
              The Zonal Value information is for informational purposes only and is not an official appraisal.<br>
              For official valuations please consult a licensed appraiser or the BIR.
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
              Sent via <strong>ZonalValue</strong> by 
              <a href="https://filipinohomes.com" style="color:#1e40af;text-decoration:none;">Filipino Homes</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, any>;
    try {
      body = await req.json();
    } catch (err: any) {
      console.error("[send-email] JSON parse error:", err?.message);
      return NextResponse.json(
        { ok: false, error: "Could not read request. Please try again." },
        { status: 400 }
      );
    }

    const {
      receiverName  = "",
      receiverEmail = "",
      message       = "",
      propertyTitle = "Property Report",
      pdfBase64     = null,
      pdfFilename   = "zonal-report.pdf",
    } = body;

    // ── Validate ──────────────────────────────────────────────────────────────
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!String(receiverName).trim())
      return NextResponse.json({ ok: false, error: "Receiver name is required." }, { status: 400 });
    if (!String(receiverEmail).trim() || !emailRe.test(String(receiverEmail)))
      return NextResponse.json({ ok: false, error: "Valid receiver email is required." }, { status: 400 });

    const html = buildHtml({ 
      receiverName, 
      message, 
      propertyTitle, 
      pdfFilename 
    });
    
    const subject = `Property Report: ${propertyTitle}`;

<<<<<<< HEAD
    // OPTION A — Resend  (recommended for Vercel / cloud)
    // npm install resend
    // Env vars: RESEND_API_KEY   RESEND_FROM (e.g. noreply@yourdomain.com)
    // 
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

    // OPTION B — Nodemailer  (recommended for self-hosted / VPS)
    // npm install nodemailer   &&   npm install -D @types/nodemailer
    // Env vars: SMTP_HOST  SMTP_PORT  SMTP_SECURE  SMTP_USER  SMTP_PASS  SMTP_FROM
    /*
    const nodemailer = (await import("nodemailer")).default;
=======
    // ── Check env vars ────────────────────────────────────────────────────────
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "").trim();

    if (!gmailUser || !gmailPass) {
      console.error("[send-email] Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env.local");
      return NextResponse.json(
        { ok: false, error: "Email service not configured." },
        { status: 500 }
      );
    }

    // ── Transporter Setup ─────────────────────────────────────────────────────
>>>>>>> d3a21fb (update email)
    const transporter = nodemailer.createTransport({
      host:   "smtp.gmail.com",
      port:   465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      tls: { rejectUnauthorized: false },
    });

    // Verify connection
    try {
      await transporter.verify();
      console.log("[send-email] ✓ SMTP connection verified");
    } catch (verifyErr: any) {
      console.error("[send-email] SMTP verify failed:", verifyErr?.message);
      return NextResponse.json(
        { ok: false, error: "Gmail login failed. Check your App Password." },
        { status: 500 }
      );
    }

    // ── Attachments ───────────────────────────────────────────────────────────
    const attachments: any[] = [];
    if (pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      attachments.push({
        filename: pdfFilename,
        content:  pdfBuffer,
        contentType: "application/pdf",
        contentDisposition: "attachment",
        // cid allows the "Open PDF Report" button (href="cid:…") to open
        // the attachment directly in desktop email clients (Outlook, Apple Mail)
        cid: pdfFilename,
      });
      console.log(`[send-email] PDF attached: ${pdfFilename} (${Math.round(pdfBuffer.length / 1024)} KB)`);
    }

    // ── Send Email ────────────────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"ZonalValue by Filipino Homes" <${gmailUser}>`,
      to: `${receiverName} <${receiverEmail}>`,
      subject,
      html,
      attachments,
    });
<<<<<<< HEAD
    */

    // OPTION C — SendGrid
    // npm install @sendgrid/mail
    // Env vars: SENDGRID_API_KEY   SENDGRID_FROM
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

    // DEV PLACEHOLDER — remove this block once you uncomment a real provider
    console.log("[send-email] ── DEV MODE ─────────────────────────────────────");
    console.log(`  To:      ${receiverName} <${receiverEmail}>`);
    console.log(`  Subject: ${subject}`);
    console.log("[send-email] ──────────────────────────────────────────────────");
    await new Promise((r) => setTimeout(r, 800));
=======
>>>>>>> d3a21fb (update email)

    console.log(`[send-email] ✓ Sent to ${receiverEmail}`);
    return NextResponse.json({ ok: true, message: "Report sent successfully." });

  } catch (err: any) {
    console.error("[send-email] Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send email." },
      { status: 500 }
    );
  }
}