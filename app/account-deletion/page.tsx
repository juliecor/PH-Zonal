import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Your Account",
  description: "How to delete your zonalvalue.ph account and data.",
  alternates: { canonical: "/account-deletion" },
};

const CSS = "\n.zvlegal{background:#f4f7fc;min-height:100vh;color:#0f172a;\n  font-family:var(--font-outfit,\"Outfit\",-apple-system,\"Segoe UI\",Roboto,sans-serif);line-height:1.65}\n.zvlegal .bar{background:#0f1c44;color:#fff;padding:16px 20px}\n.zvlegal .bar a{color:#fff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-.01em}\n.zvlegal .bar a b{color:#7fb0ff}\n.zvlegal .wrap{max-width:760px;margin:0 auto;padding:34px 22px 90px}\n.zvlegal .card{background:#fff;border:1px solid #e3e8f2;border-radius:16px;padding:14px 30px 34px;\n  box-shadow:0 18px 40px -30px rgba(15,23,42,.4)}\n.zvlegal h1{font-size:30px;letter-spacing:-.02em;margin:22px 0 4px;line-height:1.15}\n.zvlegal h2{font-size:19px;letter-spacing:-.01em;margin:28px 0 8px;color:#0f1c44;\n  border-bottom:2px solid #e8f0ff;padding-bottom:6px}\n.zvlegal h3{font-size:15.5px;margin:18px 0 4px;color:#0f49c4}\n.zvlegal p,.zvlegal li{font-size:15px;color:#243149}\n.zvlegal p{margin:0 0 12px}\n.zvlegal ul,.zvlegal ol{margin:0 0 14px;padding-left:22px}\n.zvlegal li{margin:5px 0}\n.zvlegal a{color:#155eef;font-weight:600}\n.zvlegal code{background:#eef3ff;color:#0f49c4;padding:1px 6px;border-radius:5px;font-size:.9em}\n.zvlegal hr{border:none;border-top:1px solid #e3e8f2;margin:22px 0}\n.zvlegal .upd{color:#64748b;font-size:13px;margin:0 0 6px}\n.zvlegal .foot{color:#64748b;font-size:12.5px;margin-top:26px;text-align:center}\n";
const BODY = "<h2>Delete your account and data</h2>\n<p>zonalvalue.ph — account &amp; data deletion request</p>\n<p>You can permanently delete your zonalvalue.ph account and the personal data associated with it at any time. Choose either option below.</p>\n<h2>Option 1 — In the app (fastest)</h2>\n<ol><li>Open the <strong>zonalvalue.ph</strong> app and sign in.</li><li>Go to the <strong>Profile</strong> tab.</li><li>Tap <strong>Delete account</strong>, then confirm.</li></ol>\n<p>Your account and data are removed right away and you are signed out.</p>\n<h2>Option 2 — By email</h2>\n<p>Email <a href=\"mailto:privacy@zonalvalue.ph\">privacy@zonalvalue.ph</a> from the email address on your account, with the subject &quot;Delete my account&quot;. We will delete your account within 30 days and confirm by email.</p>\n<h2>What gets deleted</h2>\n<ul><li>Your account and profile (name, email, phone number)</li><li>Your profile photo</li><li>Your saved lots, recent searches, generated reports, and credit (token) requests</li></ul>\n<h2>What we may keep</h2>\n<p>We may retain limited records where the law requires it (for example, tax or transaction records) or to resolve disputes, as described in our <a href=\"/privacy\">Privacy Policy</a>. Any such records are kept only as long as necessary and are not used for any other purpose.</p>\n<h2>Contact</h2>\n<p>Questions about deleting your data? Email <a href=\"mailto:privacy@zonalvalue.ph\">privacy@zonalvalue.ph</a>.</p>";

export default function AccountDeletionPage() {
  return (
    <div className="zvlegal">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bar"><a href="/">zonalvalue<b>.ph</b></a></div>
      <div className="wrap">
        <div className="card" dangerouslySetInnerHTML={{ __html: BODY }} />
        <p className="foot">&copy; 2026 Leuterio Realty Corporation (Filipino Homes) &middot; zonalvalue.ph</p>
      </div>
    </div>
  );
}
