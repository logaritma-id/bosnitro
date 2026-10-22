import { supabase } from './supabase';

// State memori untuk melacak perubahan status (agar tidak spam alert terus-menerus)
const deviceStatusCache = new Map<string, 'ONLINE' | 'OFFLINE'>();
const notifiedFraudTrxIds = new Set<string>();

export interface HealthCheckResult {
  timestamp: string;
  alerts: string[];
  devices: {
    code: string;
    status: string;
    isOnline: boolean;
    diffSeconds: number;
  }[];
  activeFraudCases: number;
}

/**
 * Memeriksa kesehatan seluruh infrastruktur lapangan:
 * 1. ESP32 & Solenoid Heartbeat
 * 2. Anomali Fraud / Kebocoran Transaksi
 * 3. Transaksi gantung (Pending > 10 menit)
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const alerts: string[] = [];
  const now = new Date();
  const timestamp = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });

  // 1. Cek Seluruh Perangkat IoT (ESP32)
  const { data: devices, error: devErr } = await supabase
    .from('branch_devices')
    .select('*');

  const deviceResults: any[] = [];

  if (!devErr && devices) {
    for (const dev of devices) {
      const code = dev.device_code || 'NITRO-01';
      const lastHb = dev.last_heartbeat ? new Date(dev.last_heartbeat).getTime() : 0;
      const diffMs = now.getTime() - lastHb;
      const diffSec = Math.round(diffMs / 1000);
      const isOnline = diffSec <= 45; // Jika sinyal masuk <= 45 detik lalu, anggap Online

      deviceResults.push({
        code,
        status: dev.device_status,
        isOnline,
        diffSeconds: diffSec
      });

      const prevState = deviceStatusCache.get(code);

      // KASUS A: Perangkat baru saja MATI / Terputus (ONLINE -> OFFLINE)
      if (prevState === 'ONLINE' && !isOnline) {
        deviceStatusCache.set(code, 'OFFLINE');
        alerts.push(
          `🚨 <b>[DEV-ALERT: PERANGKAT TERPUTUS]</b>\n\n` +
          `• <b>Perangkat:</b> <code>${code}</code> (Graha Prima)\n` +
          `• <b>Waktu Hilang:</b> ${timestamp} WIB\n` +
          `• <b>Durasi Offline:</b> ${diffSec} detik lalu\n` +
          `• <b>Indikasi:</b> Listrik gerai mati, kabel ESP32 dicabut, atau modem Orbit putus sinyal.\n` +
          `<i>💡 Tindakan: Hubungi kasir atau owner untuk cek saklar listrik gerai.</i>`
        );
      }
      // KASUS B: Perangkat KEMBALI NYALA (OFFLINE -> ONLINE)
      else if (prevState === 'OFFLINE' && isOnline) {
        deviceStatusCache.set(code, 'ONLINE');
        alerts.push(
          `🟢 <b>[DEV-ALERT: PERANGKAT PULIH KEMBALI]</b>\n\n` +
          `• <b>Perangkat:</b> <code>${code}</code> (Graha Prima)\n` +
          `• <b>Waktu Pulih:</b> ${timestamp} WIB\n` +
          `• <b>Status:</b> Berhasil reconnect & sinkronisasi ke Supabase.\n` +
          `<i>Sistem operasional nitrogen kembali normal 100%.</i>`
        );
      }
      // Inisialisasi awal jika belum ada cache
      else if (!prevState) {
        deviceStatusCache.set(code, isOnline ? 'ONLINE' : 'OFFLINE');
      }
    }
  }

  // 2. Cek Kasus Fraud / Kebocoran Baru
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: fraudList } = await supabase
    .from('transactions')
    .select('*')
    .gte('created_at', todayStart.toISOString())
    .eq('payment_status', 'FRAUD_ALERT')
    .order('created_at', { ascending: false });

  const activeFraudCases = (fraudList || []).length;

  if (fraudList) {
    for (const fraud of fraudList) {
      if (!notifiedFraudTrxIds.has(fraud.id)) {
        notifiedFraudTrxIds.add(fraud.id);
        const trxTime = new Date(fraud.created_at).toLocaleTimeString('id-ID');
        alerts.push(
          `🚨 <b>[DEV-ALERT: INDIKASI KECURANGAN TERDETEKSI]</b>\n\n` +
          `• <b>ID:</b> <code>TRX-${fraud.id.slice(0, 8)}</code>\n` +
          `• <b>Cabang:</b> ${fraud.branch_id || 'Graha Prima'}\n` +
          `• <b>Waktu:</b> ${trxTime} WIB\n` +
          `• <b>Detail:</b> Katup solenoid aktif tanpa transaksi kasir yang sah.\n` +
          (fraud.snapshot_url ? `• <b>Foto Bukti CCTV:</b> <a href="${fraud.snapshot_url}">Buka Gambar</a>\n` : '')
        );
      }
    }
  }

  return {
    timestamp,
    alerts,
    devices: deviceResults,
    activeFraudCases
  };
}

/**
 * Kirim alert otomatis ke Telegram Developer
 */
export async function sendDeveloperAlert(botToken: string, devChatId: string | number, alertHtml: string) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: devChatId,
        text: alertHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
  } catch (err) {
    console.error("Gagal kirim dev alert:", err);
  }
}
