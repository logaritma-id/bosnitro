import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, deviceCode = 'NITRO-01', payload } = body;

    const nowIso = new Date().toISOString();

    // 1. Aksi: Reset Status Alat ke IDLE (Unfreeze jika macet / terkunci)
    if (action === 'RESET_DEVICE_IDLE') {
      const { error } = await supabase
        .from('branch_devices')
        .update({
          device_status: 'IDLE',
          active_duration_seconds: 0,
          updated_at: nowIso
        })
        .eq('device_code', deviceCode);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Perangkat ${deviceCode} berhasil di-reset ke status normal (IDLE).`
      });
    }

    // 2. Aksi: Uji Coba Katup Solenoid 3 Detik (Test Pulse IoT)
    if (action === 'TEST_PULSE_SOLENOID') {
      const { error } = await supabase
        .from('branch_devices')
        .update({
          device_status: 'ACTIVE',
          active_duration_seconds: 3,
          updated_at: nowIso
        })
        .eq('device_code', deviceCode);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Sinyal uji coba 3 detik berhasil dikirimkan ke perangkat ${deviceCode}. Katup akan membuka dan menutup otomatis.`
      });
    }

    // 3. Aksi: Kunci Darurat / Emergency Lock
    if (action === 'EMERGENCY_LOCK') {
      const { error } = await supabase
        .from('branch_devices')
        .update({
          device_status: 'LOCKED',
          updated_at: nowIso
        })
        .eq('device_code', deviceCode);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Perangkat ${deviceCode} berhasil dikunci (EMERGENCY LOCKED). Pengisian angin dinonaktifkan.`
      });
    }

    // 4. Aksi: Bersihkan Transaksi Gantung (Stuck PENDING > 15 menit)
    if (action === 'CLEAR_STUCK_TRANSACTIONS') {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      
      const { data: stuckList, error: fetchErr } = await supabase
        .from('transactions')
        .select('id')
        .eq('payment_status', 'PENDING')
        .lt('created_at', fifteenMinutesAgo);

      if (fetchErr) throw fetchErr;

      const count = (stuckList || []).length;
      if (count > 0) {
        const ids = stuckList.map(t => t.id);
        const { error: updateErr } = await supabase
          .from('transactions')
          .update({
            payment_status: 'CANCELLED_TIMEOUT',
            payment_method: 'AUTO_CANCEL'
          })
          .in('id', ids);

        if (updateErr) throw updateErr;
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil membersihkan ${count} transaksi gantung yang melebihi batas waktu 15 menit.`
      });
    }

    // 5. Aksi: Selesaikan / Arsipkan Alert Fraud (Acknowledge Fraud)
    if (action === 'RESOLVE_FRAUD_ALERTS') {
      const { error } = await supabase
        .from('transactions')
        .update({
          payment_status: 'FRAUD_RESOLVED'
        })
        .eq('payment_status', 'FRAUD_ALERT');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Semua alert fraud telah diverifikasi dan diarsipkan sebagai RESOLVED.`
      });
    }

    return NextResponse.json({ error: `Aksi "${action}" tidak dikenal.` }, { status: 400 });
  } catch (err: any) {
    console.error("DevOps Action Error:", err);
    return NextResponse.json({ error: err.message || "Gagal mengeksekusi perbaikan." }, { status: 500 });
  }
}
