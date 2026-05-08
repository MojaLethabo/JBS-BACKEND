import { Resend } from "resend";

type SendTicketParams = {
  to: string;
  eventName: string;
  startDate: Date;
  durationDays: number;
  guestName: string;
  qrDataUrl: string;
};

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const FROM = () => process.env.RESEND_FROM || "onboarding@resend.dev";

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string; }[];
}): Promise<{ sent: boolean; reason?: string }> {
  const resend = getResend();
  if (!resend) {
    console.info(`[email skipped — RESEND_API_KEY not set] Would send "${opts.subject}" to`, opts.to);
    return { sent: false, reason: "Resend not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.attachments ? { attachments: opts.attachments } : {}),
    });
    if (error) {
      console.error("[resend error]", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (e) {
    console.error(e);
    return { sent: false, reason: "Failed to send email" };
  }
}

// ── Email verification ────────────────────────────────────────────────────────

export async function sendVerificationEmail(params: {
  to: string;
  name: string | null;
  verifyUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const greeting = params.name ? `Dear ${params.name}` : "Dear User";
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your UJ Account</title>
</head>
<body style="margin:0;padding:0;background:#EFEFEF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFEFEF;padding:48px 0;">
    <tr>
      <td align="center">

        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header: UJ Orange with Logo -->
          <tr>
            <td style="background:#E8500A;padding:36px 48px 30px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- UJ Logo -->
                  <td style="vertical-align:middle;width:72px;padding-right:20px;">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/a/af/University_of_Johannesburg_Logo.svg"
                      alt="University of Johannesburg"
                      width="72"
                      height="72"
                      style="display:block;"
                    />
                  </td>
                  <!-- UJ Name & Tagline -->
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px 0;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;line-height:1.2;">
                      University of Johannesburg
                    </p>
                    <p style="margin:0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:400;">
                      Inspiring Greatness
                    </p>
                  </td>
                </tr>
              ｜｜DSML｜｜
            </td>
          </tr>

          <!-- Orange-to-white transition bar -->
          <tr>
            <td style="background:#E8500A;padding:0 48px;">
              <div style="height:1px;background:rgba(255,255,255,0.25);"></div>
            </td>
          </tr>

          <!-- Sub-header: Email Verification label -->
          <tr>
            <td style="background:#E8500A;padding:14px 48px 28px 48px;">
              <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">
                ACCOUNT VERIFICATION
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 48px 24px 48px;background:#ffffff;">
              <p style="margin:0 0 12px 0;font-size:15px;color:#1A1A1A;line-height:1.5;">
                ${greeting},
              </p>
              <p style="margin:0;font-size:14px;color:#4A4A4A;line-height:1.8;">
                Thank you for registering for a JBS Access organizer account with the University of Johannesburg.
                Please verify your email address to activate your account and start managing events.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:#E8E8E8;"></div>
            </td>
          </tr>

          <!-- Verification Button Section -->
          <tr>
            <td style="padding:36px 48px 28px 48px;background:#ffffff;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#E8500A;font-weight:700;">
                VERIFY YOUR EMAIL
              </p>
              <p style="margin:0 0 28px 0;font-size:13px;color:#666666;line-height:1.6;">
                Click the button below to complete your registration
              </p>

              <!-- Button Frame -->
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background:#E8500A;border-radius:4px;padding:14px 32px;">
                    <a href="${params.verifyUrl}" 
                       style="display:inline-block;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">
                      VERIFY MY EMAIL
                    </a>
                  </td>
                </table>
              </table>
              <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;">
                Or copy this link: <a href="${params.verifyUrl}" style="color:#E8500A;word-break:break-all;">${params.verifyUrl}</a>
              </p>
              <p style="margin:16px 0 0 0;font-size:11px;color:#E8500A;">
                ⏱️ This link expires in <strong>24 hours</strong>
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 48px 32px 48px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#FDF4EF;border-left:3px solid #E8500A;padding:14px 20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#4A4A4A;line-height:1.75;">
                      <strong style="color:#E8500A;">Didn't request this?</strong>
                      If you didn't create an account with UJ Events, you can safely ignore this email.
                      No further action is required.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1A1A1A;padding:28px 48px 12px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;width:40px;padding-right:16px;">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/a/af/University_of_Johannesburg_Logo.svg"
                      alt="UJ"
                      width="40"
                      height="40"
                      style="display:block;"
                    />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px 0;font-size:11px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">
                      University of Johannesburg
                    </p>
                    <p style="margin:0;font-size:10px;color:#999999;">
                      Auckland Park Kingsway Campus &nbsp;·&nbsp; Corner Kingsway &amp; University Road
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:16px 48px 12px 48px;">
              <div style="height:1px;background:#333333;"></div>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:12px 48px 28px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:11px;color:#999999;">
                      Support: <span style="color:#E8500A;">support@uj.ac.za</span>
                    </p>
                    <p style="margin:0;font-size:10px;color:#666666;">
                      This is a system-generated message. Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom orange accent -->
          <tr>
            <td style="background:#E8500A;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

        </table>
        <!-- /Main Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return sendMail({ to: params.to, subject: "Verify your UJ Access account", html });
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string | null;
  resetUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const greeting = params.name ? `Dear ${params.name}` : "Dear User";
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your UJ Password</title>
</head>
<body style="margin:0;padding:0;background:#EFEFEF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFEFEF;padding:48px 0;">
    <tr>
      <td align="center">

        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header: UJ Orange with Logo -->
          <tr>
            <td style="background:#E8500A;padding:36px 48px 30px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- UJ Logo -->
                  <td style="vertical-align:middle;width:72px;padding-right:20px;">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/a/af/University_of_Johannesburg_Logo.svg"
                      alt="University of Johannesburg"
                      width="72"
                      height="72"
                      style="display:block;"
                    />
                  </td>
                  <!-- UJ Name & Tagline -->
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px 0;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;line-height:1.2;">
                      University of Johannesburg
                    </p>
                    <p style="margin:0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:400;">
                      Inspiring Greatness
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Orange-to-white transition bar -->
          <tr>
            <td style="background:#E8500A;padding:0 48px;">
              <div style="height:1px;background:rgba(255,255,255,0.25);"></div>
            </td>
          </tr>

          <!-- Sub-header: Password Reset label -->
          <tr>
            <td style="background:#E8500A;padding:14px 48px 28px 48px;">
              <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">
                SECURITY NOTIFICATION
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 48px 24px 48px;background:#ffffff;">
              <p style="margin:0 0 12px 0;font-size:15px;color:#1A1A1A;line-height:1.5;">
                ${greeting},
              </p>
              <p style="margin:0;font-size:14px;color:#4A4A4A;line-height:1.8;">
                We received a request to reset the password for your UJ Access organizer account.
                If you made this request, click the button below to create a new password.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:#E8E8E8;"></div>
            </td>
          </tr>

          <!-- Reset Button Section -->
          <tr>
            <td style="padding:36px 48px 28px 48px;background:#ffffff;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#E8500A;font-weight:700;">
                RESET YOUR PASSWORD
              </p>
              <p style="margin:0 0 28px 0;font-size:13px;color:#666666;line-height:1.6;">
                This link will expire for security purposes
              </p>

              <!-- Button Frame -->
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background:#E8500A;border-radius:4px;padding:14px 32px;">
                    <a href="${params.resetUrl}" 
                       style="display:inline-block;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">
                      RESET MY PASSWORD
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;">
                Or copy this link: <a href="${params.resetUrl}" style="color:#E8500A;word-break:break-all;">${params.resetUrl}</a>
              </p>
              <p style="margin:16px 0 0 0;font-size:11px;color:#E8500A;">
                ⏱️ This link expires in <strong>1 hour</strong>
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 48px 32px 48px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#FDF4EF;border-left:3px solid #E8500A;padding:14px 20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#4A4A4A;line-height:1.75;">
                      <strong style="color:#E8500A;">Didn't request this?</strong>
                      If you didn't request a password reset, you can safely ignore this email.
                      Your password will remain unchanged, and no further action is required.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1A1A1A;padding:28px 48px 12px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;width:40px;padding-right:16px;">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/a/af/University_of_Johannesburg_Logo.svg"
                      alt="UJ"
                      width="40"
                      height="40"
                      style="display:block;"
                    />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px 0;font-size:11px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">
                      University of Johannesburg
                    </p>
                    <p style="margin:0;font-size:10px;color:#999999;">
                      Auckland Park Kingsway Campus &nbsp;·&nbsp; Corner Kingsway &amp; University Road
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:16px 48px 12px 48px;">
              <div style="height:1px;background:#333333;"></div>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:12px 48px 28px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:11px;color:#999999;">
                      Security Team: <span style="color:#E8500A;">security@uj.ac.za</span>
                    </p>
                    <p style="margin:0;font-size:10px;color:#666666;">
                      This is a system-generated message. Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom orange accent -->
          <tr>
            <td style="background:#E8500A;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

        </table>
        <!-- /Main Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return sendMail({ to: params.to, subject: "Reset your UJ Access password", html });
}

// ── Ticket email (unchanged, included for reference) ─────────────────────────

export async function sendTicketEmail(params: SendTicketParams): Promise<{ sent: boolean; reason?: string }> {

  const start = params.startDate.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
  const endHint =
    params.durationDays <= 1
      ? "Single Day Event"
      : `${params.durationDays} Days`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your UJ Event Ticket</title>
</head>
<body style="margin:0;padding:0;background:#EFEFEF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFEFEF;padding:48px 0;">
    <tr>
      <td align="center">

        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border-radius:0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header: UJ Orange with Logo -->
          <tr>
            <td style="background:#E8500A;padding:36px 48px 30px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- UJ Logo -->
                  <td style="vertical-align:middle;width:72px;padding-right:20px;">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/a/af/University_of_Johannesburg_Logo.svg"
                      alt="University of Johannesburg"
                      width="72"
                      height="72"
                      style="display:block;"
                    />
                  </td>
                  <!-- UJ Name & Tagline -->
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px 0;font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;line-height:1.2;">
                      University of Johannesburg
                    </p>
                    <p style="margin:0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:400;">
                      Inspiring Greatness
                    </p>
                  </td>
                </tr>
              </table>
            <tr>
          </tr>

          <!-- Orange-to-white transition bar -->
          <tr>
            <td style="background:#E8500A;padding:0 48px;">
              <div style="height:1px;background:rgba(255,255,255,0.25);"></div>
            </td>
          </tr>

          <!-- Sub-header: Ticket label -->
          <tr>
            <td style="background:#E8500A;padding:14px 48px 28px 48px;">
              <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">
                OFFICIAL EVENT TICKET
              </p>
            </td>
          </tr>

          <!-- Event Name -->
          <tr>
            <td style="background:#ffffff;padding:32px 48px 24px 48px;border-bottom:2px solid #E8500A;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#1A1A1A;line-height:1.35;letter-spacing:0.2px;">
                ${params.eventName}
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 48px 24px 48px;background:#ffffff;">
              <p style="margin:0 0 12px 0;font-size:15px;color:#1A1A1A;line-height:1.5;">
                Dear <strong>${params.guestName}</strong>,
              </p>
              <p style="margin:0;font-size:14px;color:#4A4A4A;line-height:1.8;">
                Your registration for the above event has been confirmed by the University of Johannesburg. 
                Please present the QR code below at the entrance upon arrival. This serves as your 
                official entry credential — kindly have it accessible on your device or as a printed copy.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:#E8E8E8;"></div>
            </td>
          </tr>

          <!-- Event Details: Date & Duration -->
          <tr>
            <td style="padding:28px 48px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Date & Time -->
                  <td width="50%" style="vertical-align:top;padding-right:12px;">
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="width:100%;background:#FDF4EF;border-top:3px solid #E8500A;padding:18px 20px;">
                      <tr>
                        <tr>
                          <p style="margin:0 0 8px 0;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#E8500A;font-weight:700;">
                            DATE &amp; TIME
                          </p>
                          <p style="margin:0;font-size:13px;font-weight:600;color:#1A1A1A;line-height:1.6;">
                            ${start}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Duration -->
                  <td width="50%" style="vertical-align:top;padding-left:12px;">
                    <table cellpadding="0" cellspacing="0" border="0"
                           style="width:100%;background:#FDF4EF;border-top:3px solid #E8500A;padding:18px 20px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 8px 0;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#E8500A;font-weight:700;">
                            DURATION
                          </p>
                          <p style="margin:0;font-size:13px;font-weight:600;color:#1A1A1A;line-height:1.6;">
                            ${endHint}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:#E8E8E8;"></div>
            </td>
          </tr>

          <!-- QR Code Section -->
          <tr>
            <td style="padding:36px 48px 28px 48px;background:#ffffff;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#E8500A;font-weight:700;">
                ENTRY PASS
              </p>
              <p style="margin:0 0 28px 0;font-size:13px;color:#666666;line-height:1.6;">
                Present this QR code at the registration desk for verification
              </p>

              <!-- QR Frame -->
              <table cellpadding="0" cellspacing="0" border="0" align="center"
                     style="display:inline-table;">
                <!-- Top orange bar -->
                <tr>
                  <td style="background:#E8500A;height:4px;border-radius:2px 2px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="background:#ffffff;border:1px solid #E0E0E0;border-top:none;border-bottom:none;padding:20px 20px 0 20px;">
                    <img src="${params.qrDataUrl}" alt="Entry QR Code" width="200" height="200"
                         style="display:block;" />
                  </td>
                </tr>
                <!-- Bottom label bar -->
                <tr>
                  <td style="background:#1A1A1A;padding:10px 20px;border-radius:0 0 2px 2px;text-align:center;">
                    <p style="margin:0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#FFFFFF;font-weight:600;">
                      UJ ACCESS CREDENTIAL
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 48px 32px 48px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#FDF4EF;border-left:3px solid #E8500A;padding:14px 20px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#4A4A4A;line-height:1.75;">
                      <strong style="color:#E8500A;">Please treat this communication as confidential.</strong>
                      Your QR code is unique to your registration, valid for a single scan at entry, and is non-transferable.
                      Forwarding or sharing this ticket may result in denial of access.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1A1A1A;padding:28px 48px 12px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Logo small -->
                  <td style="vertical-align:middle;width:40px;padding-right:16px;">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/en/a/af/University_of_Johannesburg_Logo.svg"
                      alt="UJ"
                      width="40"
                      height="40"
                      style="display:block;"
                    />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px 0;font-size:11px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">
                      University of Johannesburg
                    </p>
                    <p style="margin:0;font-size:10px;color:#999999;">
                      Auckland Park Kingsway Campus &nbsp;·&nbsp; Corner Kingsway &amp; University Road
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:16px 48px 12px 48px;">
              <div style="height:1px;background:#333333;"></div>
            </td>
          </tr>
          <tr>
            <td style="background:#1A1A1A;padding:12px 48px 28px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:11px;color:#999999;">
                      Enquiries: <span style="color:#E8500A;">events@uj.ac.za</span>
                    </p>
                    <p style="margin:0;font-size:10px;color:#666666;">
                      This is a system-generated message. Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom orange accent -->
          <tr>
            <td style="background:#E8500A;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

        </table>
        <!-- /Main Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return sendMail({
    to: params.to,
    subject: `Your UJ Event Ticket — ${params.eventName}`,
    html,
  });
}