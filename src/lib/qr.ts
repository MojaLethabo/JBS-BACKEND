import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

export async function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: { dark: "#1c1410", light: "#ffffff" },
  });
}

export async function qrPngPublicUrl(text: string, filename: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // Fallback to data URL if Supabase not configured
  if (!supabaseUrl || !supabaseKey) {
    return qrPngDataUrl(text);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate PNG buffer
  const buffer = await QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: { dark: "#1c1410", light: "#ffffff" },
  });

  const path = `qrcodes/${filename}.png`;

  const { error } = await supabase.storage
    .from("tickets")
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error("[qr upload error]", error);
    // Fallback to data URL
    return qrPngDataUrl(text);
  }

  const { data } = supabase.storage.from("tickets").getPublicUrl(path);
  return data.publicUrl;
}
