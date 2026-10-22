import { supabase } from './supabase';

export interface AgentContext {
  chatId: string | number;
  fromName: string;
  botToken: string;
}

// 1. Tool: Laporan Omset Hari Ini
export async function getOmsetReport(branchFilter?: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .neq('payment_status', 'ATTENDANCE');

    if (branchFilter && branchFilter.toLowerCase() !== 'semua') {
      query = query.ilike('branch_id', `%${branchFilter}%`);
    }

    const { data: trxList, error } = await query;
    if (error) throw error;

    const list = trxList || [];
    const completedList = list.filter(t => t.payment_status === 'COMPLETED');
    const totalOmset = completedList.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalTrx = completedList.length;

    const cashTrx = completedList.filter(t => (t.payment_method || '').toUpperCase().includes('CASH'));
    const qrisTrx = completedList.filter(t => (t.payment_method || '').toUpperCase().includes('QRIS'));

    const totalCash = cashTrx.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalQris = qrisTrx.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const avgBasket = totalTrx > 0 ? Math.round(totalOmset / totalTrx) : 0;

    const branchLabel = branchFilter && branchFilter.toLowerCase() !== 'semua' ? branchFilter : 'Semua Cabang';
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    let message = `📊 <b>LAPORAN OMSET HARI INI</b>\n`;
    message += `📍 <b>Cabang:</b> ${branchLabel}\n`;
    message += `🕒 <b>Update:</b> ${nowTime} WIB\n\n`;
    message += `💰 <b>Total Omset:</b> Rp ${totalOmset.toLocaleString('id-ID')}\n`;
    message += `🧾 <b>Total Transaksi:</b> ${totalTrx} transaksi\n`;
    message += `🛒 <b>Rata-rata/Nota:</b> Rp ${avgBasket.toLocaleString('id-ID')}\n\n`;
    message += `<b>Rincian Pembayaran:</b>\n`;
    message += `💵 <b>Tunai (Cash):</b> Rp ${totalCash.toLocaleString('id-ID')} (${cashTrx.length} trx)\n`;
    message += `📱 <b>QRIS:</b> Rp ${totalQris.toLocaleString('id-ID')} (${qrisTrx.length} trx)\n`;

    if (totalTrx === 0) {
      message += `\n<i>Belum ada transaksi selesai yang tercatat hari ini.</i>`;
    }

    return {
      text: message,
      totalOmset,
      totalTrx,
      totalCash,
      totalQris
    };
  } catch (err: any) {
    return {
      text: `⚠️ <b>Gagal membaca database transaksi:</b> ${err?.message || 'Error Supabase'}`,
      error: true
    };
  }
}

// 2. Tool: Audit Kebocoran / Fraud
export async function getFraudAudit() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: fraudAlerts } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .eq('payment_status', 'FRAUD_ALERT');

    const { data: devices } = await supabase
      .from('branch_devices')
      .select('*');

    const totalFraud = (fraudAlerts || []).length;
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    let message = `🛡️ <b>AUDIT KEAMANAN & FRAUD SENTINEL</b>\n`;
    message += `🕒 <b>Status per:</b> ${nowTime} WIB\n\n`;

    if (totalFraud === 0) {
      message += `✅ <b>KONDISI AMAN (TIDAK ADA KEBOCORAN)</b>\n`;
      message += `Semua pembukaan katup solenoid terintegrasi 100% dengan transaksi kasir. Tidak ada pengisian angin ilegal yang terdeteksi hari ini.\n\n`;
    } else {
      message += `🚨 <b>PERINGATAN: DITEMUKAN ${totalFraud} INDIKASI KECURANGAN!</b>\n`;
      fraudAlerts?.forEach((alert, idx) => {
        message += `\n<b>Kasus #${idx + 1}:</b>\n`;
        message += `• Waktu: ${new Date(alert.created_at).toLocaleTimeString('id-ID')}\n`;
        message += `• Cabang: ${alert.branch_id || 'Graha Prima'}\n`;
        if (alert.snapshot_url) {
          message += `• Foto Bukti: <a href="${alert.snapshot_url}">Lihat Snapshot</a>\n`;
        }
      });
      message += `\n<i>Harap segera periksa rekaman CCTV atau hubungi kasir yang bertugas!</i>\n\n`;
    }

    // Status Perangkat Terkini
    message += `<b>Status Perangkat IoT:</b>\n`;
    (devices || []).forEach(d => {
      const isOnline = d.last_heartbeat && (new Date().getTime() - new Date(d.last_heartbeat).getTime()) < 30000;
      message += `• <b>${d.device_code}:</b> ${isOnline ? '🟢 Online' : '🔴 Offline'} (Mode: <code>${d.device_status}</code>)\n`;
    });

    return { text: message, totalFraud };
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal melakukan audit:</b> ${err?.message}`, error: true };
  }
}

// 3. Tool: Foto Snapshot CCTV Terakhir
export async function getLatestCctvSnapshot() {
  try {
    const { data: latestTrx, error } = await supabase
      .from('transactions')
      .select('*')
      .not('snapshot_url', 'is', null)
      .neq('snapshot_url', '')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestTrx || !latestTrx.snapshot_url) {
      return {
        hasPhoto: false,
        text: `📹 <i>Belum ada snapshot CCTV yang terekam di database. Pastikan kamera atau TV Box Armbian sudah terhubung dan mengirim foto.</i>`
      };
    }

    const timeStr = new Date(latestTrx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const caption = `📹 <b>SNAPSHOT CCTV TERAKHIR</b>\n\n` +
      `🧾 <b>ID Transaksi:</b> <code>TRX-${latestTrx.id.slice(0, 8)}</code>\n` +
      `🕒 <b>Waktu:</b> ${timeStr} WIB\n` +
      `📍 <b>Cabang:</b> ${latestTrx.branch_id || 'Graha Prima'}\n` +
      `💰 <b>Total:</b> Rp ${Number(latestTrx.total_amount).toLocaleString('id-ID')} (${latestTrx.payment_method || 'CASH'})\n` +
      `🚦 <b>Status:</b> ${latestTrx.payment_status}`;

    return {
      hasPhoto: true,
      photoUrl: latestTrx.snapshot_url,
      caption: caption,
      text: caption
    };
  } catch (err: any) {
    return {
      hasPhoto: false,
      text: `⚠️ <b>Gagal mengambil snapshot CCTV:</b> ${err?.message}`,
      error: true
    };
  }
}

// 4. Tool: Status Mesin & Kontrol IoT (Lock / Unlock)
export async function controlDevice(deviceCode: string = 'NITRO-01', action: 'LOCK' | 'UNLOCK' | 'STATUS') {
  try {
    if (action === 'STATUS') {
      const { data: dev } = await supabase
        .from('branch_devices')
        .select('*')
        .eq('device_code', deviceCode)
        .single();

      if (!dev) {
        return { text: `⚠️ Perangkat <code>${deviceCode}</code> tidak ditemukan di database.` };
      }

      const diffMs = dev.last_heartbeat ? new Date().getTime() - new Date(dev.last_heartbeat).getTime() : 999999;
      const isOnline = diffMs < 30000;

      let msg = `⚙️ <b>STATUS PERANGKAT ${deviceCode}</b>\n\n`;
      msg += `📶 <b>Koneksi:</b> ${isOnline ? '🟢 Online (Terhubung)' : '🔴 Offline (Terputus)'}\n`;
      msg += `🔒 <b>Mode Kerja:</b> <code>${dev.device_status}</code>\n`;
      msg += `⏱️ <b>Durasi Katup Terakhir:</b> ${dev.active_duration_seconds} detik\n`;
      msg += `🕒 <b>Heartbeat Terakhir:</b> ${dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleTimeString('id-ID') : '-'}\n\n`;
      msg += isOnline 
        ? `<i>Perangkat siap menerima perintah remote.</i>`
        : `<i>Perangkat tidak mengirim sinyal dalam 30 detik terakhir. Cek kabel daya ESP32 atau WiFi Orbit.</i>`;

      return { text: msg, status: dev.device_status, isOnline };
    }

    const newStatus = action === 'LOCK' ? 'LOCKED' : 'IDLE';
    const { error } = await supabase
      .from('branch_devices')
      .update({
        device_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('device_code', deviceCode);

    if (error) throw error;

    if (action === 'LOCK') {
      return {
        text: `🔒 <b>PERINTAH KUNCI BERHASIL DIKIRIM!</b>\n\nMesin <b>${deviceCode}</b> sekarang berstatus <code>LOCKED</code>.\nKatup solenoid tidak akan merespons pengisian angin sampai Anda membuka kuncinya kembali.`
      };
    } else {
      return {
        text: `🔓 <b>PERINTAH BUKA KUNCI BERHASIL!</b>\n\nMesin <b>${deviceCode}</b> kembali normal (<code>IDLE</code>) dan siap melayani transaksi kasir.`
      };
    }
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal mengubah status mesin:</b> ${err?.message}`, error: true };
  }
}

// 5. Tool: Stok Menipis & Peringatan Inventori
export async function getInventoryAlert() {
  try {
    const { data: lowStock } = await supabase
      .from('products')
      .select('*')
      .lte('stok', 5)
      .order('stok', { ascending: true });

    if (!lowStock || lowStock.length === 0) {
      return { text: `📦 <b>INVENTORI AMAN</b>\n\nSemua stok produk ritel dan oli masih dalam kondisi cukup (> 5 unit).` };
    }

    let msg = `📦 <b>PERINGATAN STOK MENIPIS (≤ 5 UNIT)</b>\n\n`;
    lowStock.forEach(p => {
      msg += `• <b>${p.name}</b>: Sisa <b>${p.stok} unit</b> (Harga: Rp ${p.harga.toLocaleString('id-ID')})\n`;
    });
    msg += `\n<i>Harap jadwalkan pengadaan stok ulang agar tidak kehabisan di gerai.</i>`;
    return { text: msg };
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal membaca data stok:</b> ${err?.message}`, error: true };
  }
}

// 6. Tool: Absensi Kasir Hari Ini
export async function getOperatorAttendance() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: attendanceList } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .eq('payment_status', 'ATTENDANCE')
      .order('created_at', { ascending: true });

    if (!attendanceList || attendanceList.length === 0) {
      return {
        text: `👤 <b>ABSENSI KASIR HARI INI</b>\n\n<i>Belum ada kasir yang melakukan absensi wajah hari ini.</i>`
      };
    }

    let msg = `👤 <b>KASIR AKTIF HARI INI</b>\n\n`;
    attendanceList.forEach((att, idx) => {
      const opName = (att.payment_method || '').replace('ABSEN:', '');
      const timeStr = new Date(att.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      msg += `${idx + 1}. <b>${opName}</b> - Cabang: ${att.branch_id || 'Graha Prima'} (Masuk: ${timeStr} WIB)\n`;
      if (att.snapshot_url) {
        msg += `   📸 <a href="${att.snapshot_url}">Foto Absensi</a>\n`;
      }
    });

    return { text: msg };
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal membaca absensi:</b> ${err?.message}`, error: true };
  }
}

// 7. Otak AI Utama: Reasoning Engine (Gemini API + NLP Fallback)
export async function processOwnerMessage(prompt: string, fromName: string = "Boss") {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // A. Quick Command Handlers
  if (lower === '/start' || lower === '/menu' || lower === '/bantuan' || lower === 'halo' || lower === 'hi' || lower === 'ping') {
    return {
      type: 'text',
      text: `👋 <b>Halo ${fromName}! Saya Asisten AI Al-Kahfi.</b>\n\n` +
        `Saya siap membantu memantau operasional, keuangan, dan keamanan gerai tanpa Anda perlu membuka dashboard.\n\n` +
        `<b>Perintah Cepat yang Bisa Ditanyakan:</b>\n` +
        `• <i>"Berapa omset hari ini?"</i>\n` +
        `• <i>"Kirim foto CCTV transaksi terakhir"</i>\n` +
        `• <i>"Cek kebocoran / ada kecurangan nggak?"</i>\n` +
        `• <i>"Kunci mesin nitrogen Graha Prima"</i>\n` +
        `• <i>"Cek status alat ESP32"</i>\n` +
        `• <i>"Siapa kasir yang jaga hari ini?"</i>\n` +
        `• <i>"Cek stok produk yang mau habis"</i>\n\n` +
        `<i>Atau ketik bebas dengan bahasa sehari-hari Anda!</i>`
    };
  }

  // B. Intent: Omset / Penjualan / Laporan
  if (
    lower.includes('omset') || 
    lower.includes('pendapatan') || 
    lower.includes('penjualan') || 
    lower.includes('laporan') || 
    lower.includes('omzet') ||
    lower.includes('uang masuk') ||
    lower.includes('/omset')
  ) {
    let branch = 'semua';
    if (lower.includes('graha')) branch = 'Graha Prima';
    if (lower.includes('tambun 1')) branch = 'Tambun 1';
    if (lower.includes('tambun 2')) branch = 'Tambun 2';

    const res = await getOmsetReport(branch);
    return { type: 'text', text: res.text };
  }

  // C. Intent: CCTV Snapshot
  if (
    lower.includes('cctv') || 
    lower.includes('kamera') || 
    lower.includes('foto') || 
    lower.includes('snapshot') || 
    lower.includes('gambar') ||
    lower.includes('/cctv')
  ) {
    const res = await getLatestCctvSnapshot();
    if (res.hasPhoto && res.photoUrl) {
      return {
        type: 'photo',
        photoUrl: res.photoUrl,
        caption: res.caption
      };
    }
    return { type: 'text', text: res.text };
  }

  // D. Intent: Audit Fraud / Kebocoran
  if (
    lower.includes('fraud') || 
    lower.includes('curang') || 
    lower.includes('bocor') || 
    lower.includes('audit') || 
    lower.includes('aman') ||
    lower.includes('/fraud')
  ) {
    const res = await getFraudAudit();
    return { type: 'text', text: res.text };
  }

  // E. Intent: Kunci Mesin (Emergency Lock)
  if (
    lower.includes('kunci mesin') || 
    lower.includes('lock mesin') || 
    lower.includes('matikan mesin') || 
    lower.includes('tutup toko') ||
    lower.includes('/kunci')
  ) {
    const res = await controlDevice('NITRO-01', 'LOCK');
    return { type: 'text', text: res.text };
  }

  // F. Intent: Buka Kunci Mesin (Unlock)
  if (
    lower.includes('buka kunci') || 
    lower.includes('unlock mesin') || 
    lower.includes('aktifkan mesin') || 
    lower.includes('hidupkan mesin') ||
    lower.includes('/buka')
  ) {
    const res = await controlDevice('NITRO-01', 'UNLOCK');
    return { type: 'text', text: res.text };
  }

  // G. Intent: Status Mesin / Alat
  if (
    lower.includes('status mesin') || 
    lower.includes('status alat') || 
    lower.includes('esp32') || 
    lower.includes('alat') ||
    lower.includes('/mesin')
  ) {
    const res = await controlDevice('NITRO-01', 'STATUS');
    return { type: 'text', text: res.text };
  }

  // H. Intent: Stok Barang
  if (lower.includes('stok') || lower.includes('barang') || lower.includes('oli') || lower.includes('habis')) {
    const res = await getInventoryAlert();
    return { type: 'text', text: res.text };
  }

  // I. Intent: Absensi / Kasir Aktif
  if (lower.includes('absen') || lower.includes('kasir') || lower.includes('operator') || lower.includes('siapa jaga')) {
    const res = await getOperatorAttendance();
    return { type: 'text', text: res.text };
  }

  // J. Fallback ke Gemini API jika GEMINI_API_KEY tersedia
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const omset = await getOmsetReport();
      const fraud = await getFraudAudit();
      const dev = await controlDevice('NITRO-01', 'STATUS');

      const systemPrompt = `Anda adalah Asisten Eksekutif AI pribadi untuk Owner jaringan Nitrogen & Otomotif "Al-Kahfi".
Panggil Owner dengan sebutan sopan "Boss" atau "Bapak/Ibu". Jawab dengan ramah, profesional, ringkas, padat, dan akurat berdasarkan data operasional saat ini:

DATA SISTEM REALTIME:
- Omset Hari Ini: Rp ${omset.totalOmset?.toLocaleString('id-ID')} (${omset.totalTrx} transaksi)
- Cash: Rp ${omset.totalCash?.toLocaleString('id-ID')} | QRIS: Rp ${omset.totalQris?.toLocaleString('id-ID')}
- Status Fraud/Kebocoran: ${fraud.totalFraud === 0 ? 'Aman (100% cocok)' : `Ada ${fraud.totalFraud} kasus`}
- Status Mesin NITRO-01: ${dev.status} (${dev.isOnline ? 'Online' : 'Offline'})

Jawablah pertanyaan berikut dengan gaya manajer operasional yang handal:`;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nPertanyaan Owner: "${cleanPrompt}"` }]
            }
          ]
        })
      });

      if (geminiRes.ok) {
        const geminiJson = await geminiRes.json();
        const replyText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          return { type: 'text', text: replyText };
        }
      }
    } catch (aiErr) {
      console.error("Gemini Error:", aiErr);
    }
  }

  // Fallback Sopan jika tidak ada kata kunci yang cocok
  return {
    type: 'text',
    text: `🤖 <b>Asisten Al-Kahfi:</b>\n` +
      `Maaf Boss, saya belum sepenuhnya memahami perintah: <i>"${cleanPrompt}"</i>.\n\n` +
      `Anda bisa gunakan tombol cepat di bawah atau tanya seperti:\n` +
      `• <i>"Berapa omset hari ini?"</i>\n` +
      `• <i>"Kirim foto cctv terakhir"</i>\n` +
      `• <i>"Cek fraud / kebocoran"</i>\n` +
      `• <i>"Kunci mesin"</i>`
  };
}
