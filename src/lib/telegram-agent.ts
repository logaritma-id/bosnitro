import { supabase } from './supabase';

// State sementara untuk menyimpan Konfirmasi Aksi (In-Memory per Chat ID)
// Format: pendingActions.set(chatId, { action: string, data: any, description: string })
export const pendingActions = new Map<string | number, {
  action: string;
  data: any;
  description: string;
}>();

// Daftar ID Telegram yang diizinkan (Whitelist)
// Baim: 7061579608, Owner: -10023481920
export const ALLOWED_CHAT_IDS = new Set<string | number>([
  '7061579608',
  7061579608,
  '-10023481920',
  -10023481920
]);

// Helper: Cek Otorisasi
export function isAuthorized(chatId: string | number): boolean {
  if (ALLOWED_CHAT_IDS.size === 0) return true; // Jika whitelist kosong, izinkan semua (mode terbuka)
  return ALLOWED_CHAT_IDS.has(chatId) || ALLOWED_CHAT_IDS.has(String(chatId)) || ALLOWED_CHAT_IDS.has(Number(chatId));
}

// ---------------- KEYBOARD NAVIGATION ----------------
export const KEYBOARDS = {
  MAIN: {
    inline_keyboard: [
      [
        { text: "📊 Laporan & Omset", callback_data: "/menu_omset" },
        { text: "📹 Foto CCTV", callback_data: "/cctv" }
      ],
      [
        { text: "📦 Produk & Stok", callback_data: "/menu_produk" },
        { text: "👥 Karyawan & Kasir", callback_data: "/menu_karyawan" }
      ],
      [
        { text: "🛡️ Audit Fraud", callback_data: "/fraud" },
        { text: "⚡ Kontrol Mesin IoT", callback_data: "/menu_mesin" }
      ]
    ]
  },
  PRODUK: {
    inline_keyboard: [
      [
        { text: "➕ Panduan Tambah Produk", callback_data: "/panduan_tambah_produk" },
        { text: "🏷️ Panduan Ubah Harga", callback_data: "/panduan_ubah_harga" }
      ],
      [
        { text: "📥 Panduan Tambah Stok", callback_data: "/panduan_tambah_stok" },
        { text: "⚠️ Cek Stok Menipis", callback_data: "/stok_menipis" }
      ],
      [
        { text: "📋 Lihat Semua Produk", callback_data: "/semua_produk" },
        { text: "🔙 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  KARYAWAN: {
    inline_keyboard: [
      [
        { text: "👤 Siapa Kasir Jaga?", callback_data: "/kasir" },
        { text: "🔑 Panduan Ganti PIN", callback_data: "/panduan_ganti_pin" }
      ],
      [
        { text: "➕ Panduan Tambah Kasir", callback_data: "/panduan_tambah_kasir" },
        { text: "🔙 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  MESIN: {
    inline_keyboard: [
      [
        { text: "⚙️ Status Alat (ESP32)", callback_data: "/mesin" },
        { text: "⏱️ Durasi Katup", callback_data: "/durasi_katup" }
      ],
      [
        { text: "🔒 KUNCI MESIN (Lock)", callback_data: "/kunci" },
        { text: "🔓 BUKA KUNCI (Unlock)", callback_data: "/buka" }
      ],
      [
        { text: "🔙 Menu Utama", callback_data: "/menu_utama" }
      ]
    ]
  },
  CONFIRMATION: {
    inline_keyboard: [
      [
        { text: "✅ Ya, Eksekusi Sekarang", callback_data: "CONFIRM_ACTION" },
        { text: "❌ Batal", callback_data: "CANCEL_ACTION" }
      ]
    ]
  }
};

// ---------------- 1. FITUR LAPORAN OMSET ----------------
export async function getOmsetReport(branchFilter?: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .neq('payment_status', 'ATTENDANCE')
      .neq('branch_id', 'SYSTEM');

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

    const branchLabel = branchFilter && branchFilter.toLowerCase() !== 'semua' ? branchFilter : 'Graha Prima';
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
      message += `\n<i>Belum ada transaksi pengerjaan yang diselesaikan hari ini.</i>`;
    }

    return { text: message, totalOmset, totalTrx, totalCash, totalQris };
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal membaca database transaksi:</b> ${err?.message}`, error: true };
  }
}

// ---------------- 2. FITUR AUDIT FRAUD ----------------
export async function getFraudAudit() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: fraudAlerts } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .eq('payment_status', 'FRAUD_ALERT');

    const { data: devices } = await supabase.from('branch_devices').select('*');
    const totalFraud = (fraudAlerts || []).length;
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    let message = `🛡️ <b>AUDIT KEAMANAN & FRAUD SENTINEL</b>\n`;
    message += `🕒 <b>Status per:</b> ${nowTime} WIB\n\n`;

    if (totalFraud === 0) {
      message += `✅ <b>KONDISI AMAN (TIDAK ADA KEBOCORAN)</b>\n`;
      message += `Semua pembukaan katup solenoid terintegrasi 100% dengan transaksi kasir. Tidak ada pengisian angin ilegal hari ini.\n\n`;
    } else {
      message += `🚨 <b>PERINGATAN: DITEMUKAN ${totalFraud} INDIKASI KECURANGAN!</b>\n\n`;
    }

    message += `<b>Status Perangkat IoT:</b>\n`;
    (devices || []).forEach(d => {
      const isOnline = d.last_heartbeat && (new Date().getTime() - new Date(d.last_heartbeat).getTime()) < 30000;
      message += `• <b>${d.device_code}:</b> ${isOnline ? '🟢 Online' : '🔴 Offline'} (Mode: <code>${d.device_status}</code>)\n`;
    });

    return { text: message, totalFraud };
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal audit:</b> ${err?.message}`, error: true };
  }
}

// ---------------- 3. FITUR SNAPSHOT CCTV ----------------
export async function getLatestCctvSnapshot() {
  try {
    const { data: latestTrx, error } = await supabase
      .from('transactions')
      .select('*')
      .neq('branch_id', 'SYSTEM')
      .like('snapshot_url', 'http%')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestTrx || !latestTrx.snapshot_url) {
      return {
        hasPhoto: false,
        text: `📹 <i>Belum ada foto snapshot CCTV di database.</i>\n\nBegitu CCTV dan Armbian TV Box di lapangan terpasang, setiap kasir menekan tombol selesai di kasir, foto motor dan pelanggan akan langsung dikirimkan ke sini secara otomatis!`
      };
    }

    const timeStr = new Date(latestTrx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const caption = `📹 <b>SNAPSHOT CCTV TRANSAKSI TERAKHIR</b>\n\n` +
      `🧾 <b>ID Transaksi:</b> <code>TRX-${latestTrx.id.slice(0, 8)}</code>\n` +
      `🕒 <b>Waktu:</b> ${timeStr} WIB\n` +
      `📍 <b>Cabang:</b> ${latestTrx.branch_id || 'Graha Prima'}\n` +
      `💰 <b>Total:</b> Rp ${Number(latestTrx.total_amount).toLocaleString('id-ID')} (${latestTrx.payment_method || 'CASH'})\n` +
      `🚦 <b>Status:</b> ${latestTrx.payment_status}`;

    return { hasPhoto: true, photoUrl: latestTrx.snapshot_url, caption, text: caption };
  } catch (err: any) {
    return { hasPhoto: false, text: `⚠️ Gagal mengambil snapshot CCTV: ${err?.message}`, error: true };
  }
}

// ---------------- 4. KONTROL IOT / MESIN ----------------
export async function controlDevice(deviceCode: string = 'NITRO-01', action: 'LOCK' | 'UNLOCK' | 'STATUS') {
  try {
    if (action === 'STATUS') {
      const { data: dev } = await supabase.from('branch_devices').select('*').eq('device_code', deviceCode).single();
      if (!dev) return { text: `⚠️ Perangkat <code>${deviceCode}</code> tidak ditemukan.` };

      const diffMs = dev.last_heartbeat ? new Date().getTime() - new Date(dev.last_heartbeat).getTime() : 999999;
      const isOnline = diffMs < 30000;

      let msg = `⚙️ <b>STATUS MESIN NITROGEN (${deviceCode})</b>\n\n`;
      msg += `📶 <b>Koneksi:</b> ${isOnline ? '🟢 Online' : '🔴 Offline'}\n`;
      msg += `🔒 <b>Mode Perangkat:</b> <code>${dev.device_status}</code>\n`;
      msg += `⏱️ <b>Durasi Katup:</b> ${dev.active_duration_seconds} detik\n`;
      msg += `🕒 <b>Heartbeat:</b> ${dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleTimeString('id-ID') : '-'}\n\n`;
      msg += isOnline ? `<i>Perangkat siap melayani transaksi kasir & bot.</i>` : `<i>Perangkat offline (ESP32 sedang dicabut dari listrik).</i>`;
      return { text: msg, status: dev.device_status, isOnline };
    }

    const newStatus = action === 'LOCK' ? 'LOCKED' : 'IDLE';
    await supabase.from('branch_devices').update({ device_status: newStatus, updated_at: new Date().toISOString() }).eq('device_code', deviceCode);

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
    return { text: `⚠️ Gagal mengubah status mesin: ${err?.message}`, error: true };
  }
}

// ---------------- 5. KELOLA KARYAWAN & PIN ----------------
export async function getOperatorAttendance(branchFilter?: string) {
  try {
    const { data: opConfig } = await supabase
      .from('transactions')
      .select('snapshot_url')
      .eq('payment_status', 'SYSTEM_CONFIG_OPERATORS')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let operators: any[] = [];
    if (opConfig && opConfig.snapshot_url) {
      try {
        operators = JSON.parse(opConfig.snapshot_url);
      } catch (e) {}
    }

    let filteredOps = operators;
    if (branchFilter && branchFilter.toLowerCase() !== 'semua') {
      filteredOps = operators.filter(o => (o.branch || '').toLowerCase().includes(branchFilter.toLowerCase()));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: attendanceList } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', today.toISOString())
      .eq('payment_status', 'ATTENDANCE')
      .order('created_at', { ascending: true });

    let msg = `👤 <b>INFORMASI KASIR & OPERATOR AL-KAHFI</b>\n\n`;
    if (branchFilter && branchFilter.toLowerCase() !== 'semua') {
      msg += `📍 <b>Cabang:</b> ${branchFilter}\n\n`;
    }

    if (filteredOps.length > 0) {
      filteredOps.forEach((op, idx) => {
        const attendance = (attendanceList || []).find(a => (a.payment_method || '').includes(op.name));
        const statusAbsen = attendance ? '🟢 <b>Sudah Absen Wajah (Aktif)</b>' : '⚪ <i>Belum absen hari ini</i>';
        msg += `${idx + 1}. <b>${op.name}</b> (${op.role || 'Operator'})\n`;
        msg += `• Cabang: ${op.branch || 'Semua Cabang'}\n`;
        msg += `• PIN: <code>${op.pin}</code>\n`;
        msg += `• Status Hari Ini: ${statusAbsen}\n\n`;
      });
    } else {
      msg += `<i>Belum ada operator yang terdaftar untuk cabang ini.</i>\n`;
    }

    return { text: msg };
  } catch (err: any) {
    return { text: `⚠️ Gagal membaca data kasir: ${err?.message}`, error: true };
  }
}

// ---------------- 6. KELOLA MASTER PRODUK & STOK ----------------

// A. Lihat Semua Produk / Stok Menipis
export async function getProductsList(onlyLowStock: boolean = false) {
  try {
    let query = supabase.from('products').select('*');
    if (onlyLowStock) {
      query = query.lte('stok', 5).order('stok', { ascending: true });
    } else {
      query = query.order('id', { ascending: true });
    }

    const { data: products, error } = await query;
    if (error) throw error;

    if (!products || products.length === 0) {
      return {
        text: onlyLowStock 
          ? `📦 <b>INVENTORI AMAN!</b>\n\nSemua stok produk ritel dan oli masih aman di atas 5 unit.`
          : `📦 <i>Belum ada produk yang terdaftar di Master Produk.</i>`
      };
    }

    let msg = onlyLowStock 
      ? `⚠️ <b>PERINGATAN STOK MENIPIS (≤ 5 UNIT)</b>\n\n`
      : `📦 <b>DAFTAR MASTER PRODUK & STOK KASIR</b>\n\n`;

    products.forEach((p, idx) => {
      const margin = p.harga - (p.hpp || 0);
      const stockBadge = p.stok <= 5 ? `⚠️ <b>${p.stok} unit</b>` : `${p.stok} unit`;
      msg += `${idx + 1}. <b>${p.name}</b> (${p.category || 'ritel'})\n`;
      msg += `   • Harga Jual: <b>Rp ${p.harga.toLocaleString('id-ID')}</b>\n`;
      msg += `   • Modal (HPP): Rp ${(p.hpp || 0).toLocaleString('id-ID')} (Laba: Rp ${margin.toLocaleString('id-ID')})\n`;
      msg += `   • Sisa Stok: ${stockBadge}\n\n`;
    });

    return { text: msg };
  } catch (err: any) {
    return { text: `⚠️ Gagal mengambil master produk: ${err?.message}`, error: true };
  }
}

// B. Parser Input Produk Baru (Mempersiapkan Kartu Konfirmasi)
export function prepareAddProduct(text: string, chatId: string | number) {
  // Format kilat: +produk [Nama] | [Jual] | [Modal] | [Stok]
  // Contoh: +produk Lap Microfiber | 15000 | 8000 | 25
  const parts = text.replace(/^\+produk\s+/i, '').split('|').map(s => s.trim());
  if (parts.length >= 2) {
    const name = parts[0];
    const harga = parseInt(parts[1].replace(/[^0-9]/g, '')) || 0;
    const hpp = parts[2] ? parseInt(parts[2].replace(/[^0-9]/g, '')) || 0 : Math.round(harga * 0.7);
    const stok = parts[3] ? parseInt(parts[3].replace(/[^0-9]/g, '')) || 10 : 10;
    const category = name.toLowerCase().includes('ban') || name.toLowerCase().includes('nitrogen') ? 'nitrogen' : 'ritel';

    const margin = harga - hpp;
    const marginPct = harga > 0 ? ((margin / harga) * 100).toFixed(1) : '0';

    pendingActions.set(chatId, {
      action: 'ADD_PRODUCT',
      data: { name, harga, hpp, stok, category },
      description: `Tambah Produk "${name}"`
    });

    const card = `📦 <b>KONFIRMASI INPUT PRODUK BARU</b>\n` +
      `──────────────────────────\n` +
      `• <b>Nama Produk:</b> ${name}\n` +
      `• <b>Kategori:</b> ${category.toUpperCase()}\n` +
      `• <b>Harga Jual:</b> Rp ${harga.toLocaleString('id-ID')}\n` +
      `• <b>Modal (HPP):</b> Rp ${hpp.toLocaleString('id-ID')}\n` +
      `• <b>Laba Bersih:</b> Rp ${margin.toLocaleString('id-ID')} (${marginPct}%)\n` +
      `• <b>Stok Masuk:</b> ${stok} unit\n` +
      `──────────────────────────\n` +
      `<i>Apakah data ini sudah benar dan mau disimpan ke Kasir?</i>`;

    return { isConfirm: true, text: card };
  }

  // Jika format salah, beri petunjuk
  return {
    isConfirm: false,
    text: `💡 <b>Format Input Produk Cepat:</b>\n\n` +
      `Ketik:\n<code>+produk [Nama] | [Harga Jual] | [Modal HPP] | [Stok]</code>\n\n` +
      `<b>Contoh:</b>\n<code>+produk Lap Microfiber | 15000 | 8000 | 20</code>\n` +
      `<code>+produk Ban Tubles IRC | 210000 | 175000 | 5</code>`
  };
}

// C. Parser Ubah Harga Produk
export async function prepareUpdatePrice(text: string, chatId: string | number) {
  // Format: +harga [Nama] [Harga Baru]
  // Contoh: +harga Tambal Ban 18000
  const clean = text.replace(/^\+harga\s+/i, '').trim();
  const words = clean.split(/\s+/);
  const newPriceStr = words[words.length - 1].replace(/[^0-9]/g, '');
  const newPrice = parseInt(newPriceStr);
  const prodSearch = words.slice(0, words.length - 1).join(' ').trim();

  if (!newPrice || !prodSearch) {
    return {
      isConfirm: false,
      text: `💡 <b>Format Ubah Harga Cepat:</b>\n\n` +
        `Ketik: <code>+harga [Nama Produk] [Harga Baru]</code>\n\n` +
        `<b>Contoh:</b>\n<code>+harga Tambal Ban 18000</code>\n<code>+harga Oli MPX 58000</code>`
    };
  }

  const { data: matched } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${prodSearch}%`)
    .limit(1)
    .single();

  if (!matched) {
    return { isConfirm: false, text: `⚠️ Produk dengan kata kunci <i>"${prodSearch}"</i> tidak ditemukan di Master Produk.` };
  }

  pendingActions.set(chatId, {
    action: 'UPDATE_PRICE',
    data: { id: matched.id, name: matched.name, oldPrice: matched.harga, newPrice },
    description: `Ubah Harga "${matched.name}"`
  });

  const card = `🏷️ <b>KONFIRMASI PERUBAHAN HARGA PRODUK</b>\n` +
    `──────────────────────────\n` +
    `• <b>Produk:</b> ${matched.name}\n` +
    `• <b>Harga Sekarang:</b> Rp ${matched.harga.toLocaleString('id-ID')}\n` +
    `• <b>Harga Baru:</b> <b>Rp ${newPrice.toLocaleString('id-ID')}</b>\n` +
    `──────────────────────────\n` +
    `<i>Harga di tablet kasir akan langsung berubah saat Anda klik Simpan. Lanjutkan?</i>`;

  return { isConfirm: true, text: card };
}

// D. Parser Tambah Stok Produk
export async function prepareUpdateStock(text: string, chatId: string | number) {
  // Format: +stok [Nama] [Jumlah Tambahan]
  // Contoh: +stok Oli MPX 24
  const clean = text.replace(/^\+stok\s+/i, '').trim();
  const words = clean.split(/\s+/);
  const qtyStr = words[words.length - 1].replace(/[^0-9]/g, '');
  const qty = parseInt(qtyStr);
  const prodSearch = words.slice(0, words.length - 1).join(' ').trim();

  if (!qty || !prodSearch) {
    return {
      isConfirm: false,
      text: `💡 <b>Format Tambah Stok Cepat:</b>\n\n` +
        `Ketik: <code>+stok [Nama Produk] [Jumlah Tambah]</code>\n\n` +
        `<b>Contoh:</b>\n<code>+stok Oli MPX 24</code>\n<code>+stok Cairan Tubles 10</code>`
    };
  }

  const { data: matched } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${prodSearch}%`)
    .limit(1)
    .single();

  if (!matched) {
    return { isConfirm: false, text: `⚠️ Produk dengan kata kunci <i>"${prodSearch}"</i> tidak ditemukan di Master Produk.` };
  }

  const newTotal = (matched.stok || 0) + qty;

  pendingActions.set(chatId, {
    action: 'UPDATE_STOCK',
    data: { id: matched.id, name: matched.name, addedQty: qty, newTotal },
    description: `Tambah Stok "${matched.name}"`
  });

  const card = `📥 <b>KONFIRMASI TAMBAH STOK BARANG</b>\n` +
    `──────────────────────────\n` +
    `• <b>Produk:</b> ${matched.name}\n` +
    `• <b>Stok Saat Ini:</b> ${matched.stok} unit\n` +
    `• <b>Jumlah Masuk:</b> +${qty} unit\n` +
    `• <b>Total Akhir:</b> <b>${newTotal} unit</b>\n` +
    `──────────────────────────\n` +
    `<i>Apakah stok fisik barang sudah dicek dan siap disimpan ke kasir?</i>`;

  return { isConfirm: true, text: card };
}

// E. Eksekusi Aksi yang Terkonfirmasi
export async function executePendingAction(chatId: string | number) {
  const pending = pendingActions.get(chatId);
  if (!pending) {
    return { text: `⚠️ Tidak ada perintah pending yang menunggu konfirmasi.` };
  }

  pendingActions.delete(chatId);

  try {
    if (pending.action === 'ADD_PRODUCT') {
      const { name, harga, hpp, stok, category } = pending.data;
      const { error } = await supabase.from('products').insert({
        name,
        harga,
        hpp,
        stok,
        category,
        img: `https://placehold.co/100x100/1e293b/ffffff?text=${encodeURIComponent(name.slice(0, 8))}`
      });
      if (error) throw error;
      return {
        text: `✅ <b>SUKSES! PRODUK BERHASIL DITAMBAHKAN</b>\n\n` +
          `Produk <b>"${name}"</b> (Harga: Rp ${harga.toLocaleString('id-ID')}, Stok: ${stok}) sekarang sudah aktif di database dan langsung muncul di layar tablet kasir!`
      };
    }

    if (pending.action === 'UPDATE_PRICE') {
      const { id, name, newPrice } = pending.data;
      const { error } = await supabase.from('products').update({ harga: newPrice, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return {
        text: `✅ <b>SUKSES! HARGA DIPERBARUI</b>\n\n` +
          `Harga <b>"${name}"</b> resmi diubah menjadi <b>Rp ${newPrice.toLocaleString('id-ID')}</b>. Kasir akan menggunakan harga baru ini secara instan.`
      };
    }

    if (pending.action === 'UPDATE_STOCK') {
      const { id, name, addedQty, newTotal } = pending.data;
      const { error } = await supabase.from('products').update({ stok: newTotal, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return {
        text: `✅ <b>SUKSES! STOK BERHASIL DITAMBAHKAN</b>\n\n` +
          `Stok <b>"${name}"</b> bertambah +${addedQty} unit. Total stok terkini di kasir: <b>${newTotal} unit</b>.`
      };
    }

    return { text: `Aksi tidak dikenal.` };
  } catch (err: any) {
    return { text: `⚠️ <b>Gagal eksekusi ke database:</b> ${err?.message}` };
  }
}

// ---------------- 7. PROSESOR PESAN UTAMA (ROUTER AI) ----------------
export async function processOwnerMessage(prompt: string, fromName: string = "Boss", chatId: string | number = "") {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();

  // A. Gerbang Keamanan (Security Whitelist)
  if (chatId && !isAuthorized(chatId)) {
    return {
      type: 'text',
      text: `⛔ <b>AKSES DITOLAK</b>\n\n` +
        `Maaf ${fromName}, akun Telegram Anda (ID: <code>${chatId}</code>) tidak terdaftar dalam Whitelist Administrator Al-Kahfi.\n` +
        `Hubungi Owner untuk mendaftarkan Chat ID Anda.`
    };
  }

  // B. Eksekusi Tombol Konfirmasi / Batal
  if (clean === 'CONFIRM_ACTION') {
    const res = await executePendingAction(chatId);
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MAIN };
  }
  if (clean === 'CANCEL_ACTION') {
    pendingActions.delete(chatId);
    return { type: 'text', text: `❌ <b>Perintah dibatalkan.</b> Tidak ada perubahan data di database kasir.`, keyboard: KEYBOARDS.MAIN };
  }

  // C. Navigasi Menu
  if (lower === '/start' || lower === '/menu' || lower === '/menu_utama') {
    return {
      type: 'text',
      text: `👋 <b>Halo ${fromName}! Saya Asisten AI Al-Kahfi.</b>\n\n` +
        `Pusat kendali POS Kasir, Master Stok, Karyawan, dan Mesin IoT berada dalam genggaman Anda.\n\n` +
        `Silakan pilih menu di bawah atau ketik perintah langsung!`,
      keyboard: KEYBOARDS.MAIN
    };
  }

  if (lower === '/menu_produk') {
    return {
      type: 'text',
      text: `📦 <b>MENU KELOLA MASTER PRODUK & STOK</b>\n\n` +
        `Anda bisa menambah produk baru, menaikkan/menurunkan harga jual, atau menambah stok barang langsung dari sini tanpa perlu membuka dashboard web.\n\n` +
        `Pilih opsi di bawah atau gunakan perintah kilat:`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  if (lower === '/menu_karyawan') {
    return {
      type: 'text',
      text: `👥 <b>MENU MANAJEMEN KARYAWAN & SHIFT</b>\n\n` +
        `Pantau kasir yang sedang aktif bertugas atau ubah PIN login kasir dari jarak jauh.`,
      keyboard: KEYBOARDS.KARYAWAN
    };
  }

  if (lower === '/menu_mesin') {
    return {
      type: 'text',
      text: `⚡ <b>MENU KONTROL MESIN IOT AL-KAHFI</b>\n\n` +
        `Kendalikan katup solenoid nitrogen di gerai secara remote via ESP32.`,
      keyboard: KEYBOARDS.MESIN
    };
  }

  // D. Panduan & Shortcut
  if (lower === '/panduan_tambah_produk') {
    return {
      type: 'text',
      text: `💡 <b>CARA CEPAT MENAMBAH PRODUK BARU:</b>\n\n` +
        `Ketik dengan format:\n` +
        `<code>+produk [Nama] | [Harga Jual] | [Modal HPP] | [Stok]</code>\n\n` +
        `<b>Contoh Siap Pakai (Salin & Sesuaikan):</b>\n` +
        `<code>+produk Lap Microfiber | 15000 | 8000 | 25</code>\n` +
        `<code>+produk Oli Enduro Matic | 52000 | 40000 | 12</code>`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  if (lower === '/panduan_ubah_harga') {
    return {
      type: 'text',
      text: `💡 <b>CARA CEPAT UBAH HARGA PRODUK:</b>\n\n` +
        `Ketik dengan format:\n` +
        `<code>+harga [Nama Produk] [Harga Baru]</code>\n\n` +
        `<b>Contoh:</b>\n` +
        `<code>+harga Tambal Ban 18000</code>\n` +
        `<code>+harga Oli MPX 58000</code>`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  if (lower === '/panduan_tambah_stok') {
    return {
      type: 'text',
      text: `💡 <b>CARA CEPAT MENAMBAH STOK BARANG:</b>\n\n` +
        `Ketik dengan format:\n` +
        `<code>+stok [Nama Produk] [Jumlah Tambah]</code>\n\n` +
        `<b>Contoh:</b>\n` +
        `<code>+stok Oli MPX 24</code>\n` +
        `<code>+stok Cairan Tubles 10</code>`,
      keyboard: KEYBOARDS.PRODUK
    };
  }

  // E. Eksekutor Perintah Format Kilat
  if (lower.startsWith('+produk ') || lower.includes('tambah produk baru')) {
    const res = prepareAddProduct(clean, chatId);
    return {
      type: 'text',
      text: res.text,
      keyboard: res.isConfirm ? KEYBOARDS.CONFIRMATION : KEYBOARDS.PRODUK
    };
  }

  if (lower.startsWith('+harga ') || (lower.includes('ubah harga') && /\d+/.test(lower))) {
    const res = await prepareUpdatePrice(clean, chatId);
    return {
      type: 'text',
      text: res.text,
      keyboard: res.isConfirm ? KEYBOARDS.CONFIRMATION : KEYBOARDS.PRODUK
    };
  }

  if (lower.startsWith('+stok ') || (lower.includes('tambah stok') && /\d+/.test(lower))) {
    const res = await prepareUpdateStock(clean, chatId);
    return {
      type: 'text',
      text: res.text,
      keyboard: res.isConfirm ? KEYBOARDS.CONFIRMATION : KEYBOARDS.PRODUK
    };
  }

  // F. Eksekutor Cek Stok Produk
  if (lower === '/semua_produk' || lower.includes('semua produk') || lower.includes('daftar produk')) {
    const res = await getProductsList(false);
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.PRODUK };
  }
  if (lower === '/stok_menipis' || lower.includes('stok menipis') || lower.includes('stok habis')) {
    const res = await getProductsList(true);
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.PRODUK };
  }

  // G. Eksekutor Laporan Omset
  if (lower.includes('omset') || lower.includes('pendapatan') || lower.includes('/menu_omset')) {
    let branch = 'semua';
    if (lower.includes('graha')) branch = 'Graha Prima';
    const res = await getOmsetReport(branch);
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MAIN };
  }

  // H. Eksekutor CCTV
  if (lower.includes('cctv') || lower.includes('kamera') || lower.includes('foto') || lower.includes('/cctv')) {
    const res = await getLatestCctvSnapshot();
    if (res.hasPhoto && res.photoUrl) {
      return { type: 'photo', photoUrl: res.photoUrl, caption: res.caption, keyboard: KEYBOARDS.MAIN };
    }
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MAIN };
  }

  // I. Eksekutor Fraud
  if (lower.includes('fraud') || lower.includes('curang') || lower.includes('bocor') || lower.includes('/fraud')) {
    const res = await getFraudAudit();
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MAIN };
  }

  // J. Eksekutor Mesin & Kunci
  if (lower.includes('kunci mesin') || lower.includes('lock') || lower === '/kunci') {
    const res = await controlDevice('NITRO-01', 'LOCK');
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MESIN };
  }
  if (lower.includes('buka kunci') || lower.includes('unlock') || lower === '/buka') {
    const res = await controlDevice('NITRO-01', 'UNLOCK');
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MESIN };
  }
  if (lower.includes('status mesin') || lower.includes('esp32') || lower === '/mesin') {
    const res = await controlDevice('NITRO-01', 'STATUS');
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.MESIN };
  }

  // K. Eksekutor Kasir Jaga
  if (lower.includes('kasir') || lower.includes('operator') || lower.includes('siapa jaga') || lower === '/kasir') {
    let branch = 'semua';
    if (lower.includes('graha')) branch = 'Graha Prima';
    const res = await getOperatorAttendance(branch);
    return { type: 'text', text: res.text, keyboard: KEYBOARDS.KARYAWAN };
  }

  // Default Fallback
  return {
    type: 'text',
    text: `🤖 <b>Asisten AI Al-Kahfi:</b>\n` +
      `Siap Boss! Saya belum sepenuhnya memahami perintah: <i>"${clean}"</i>.\n\n` +
      `Gunakan menu di bawah atau ketik perintah kilat seperti:\n` +
      `• <code>+produk Lap Kain | 10000 | 5000 | 20</code>\n` +
      `• <code>+harga Tambal Ban 18000</code>\n` +
      `• <code>+stok Oli MPX 12</code>\n` +
      `• <i>"Berapa omset hari ini?"</i>`,
    keyboard: KEYBOARDS.MAIN
  };
}
