"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  Server,
  Cpu,
  Camera,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Zap,
  Lock,
  Unlock,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

interface DeviceState {
  code: string;
  status: string;
  isOnline: boolean;
  activeDuration: number;
  lastHeartbeat: string | null;
  diffSeconds: number;
}

export default function SystemStatusPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [dbLatency, setDbLatency] = useState<number>(0);
  const [todayTrxCount, setTodayTrxCount] = useState(0);
  const [fraudCount, setFraudCount] = useState(0);
  const [latestCctvTime, setLatestCctvTime] = useState<string | null>(null);
  const [pendingTrxCount, setPendingTrxCount] = useState(0);

  // State Aksi Perbaikan
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [actionLogs, setActionLogs] = useState<string[]>([]);

  const fetchTelemetry = async () => {
    try {
      const startPing = performance.now();

      // 1. Cek Supabase & Latency
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [devRes, trxRes, cctvRes, pendingRes] = await Promise.all([
        supabase.from("branch_devices").select("*").eq("device_code", "NITRO-01").single(),
        supabase.from("transactions").select("id, payment_status").gte("created_at", today.toISOString()),
        supabase.from("transactions").select("created_at").not("snapshot_url", "is", null).neq("branch_id", "SYSTEM").like("snapshot_url", "http%").order("created_at", { ascending: false }).limit(1).single(),
        supabase.from("transactions").select("id").eq("payment_status", "PENDING")
      ]);

      const endPing = performance.now();
      setDbLatency(Math.round(endPing - startPing));

      // 2. Evaluasi Hardware NITRO-01
      if (devRes.data) {
        const d = devRes.data;
        const lastHb = d.last_heartbeat ? new Date(d.last_heartbeat).getTime() : 0;
        const diffSec = Math.round((Date.now() - lastHb) / 1000);
        const isOnline = diffSec <= 45;

        setDevice({
          code: d.device_code,
          status: d.device_status,
          isOnline,
          activeDuration: d.active_duration_seconds || 0,
          lastHeartbeat: d.last_heartbeat,
          diffSeconds: diffSec
        });
      }

      // 3. Evaluasi Transaksi & Fraud
      if (trxRes.data) {
        const list = trxRes.data;
        setTodayTrxCount(list.filter(t => t.payment_status === "COMPLETED").length);
        setFraudCount(list.filter(t => t.payment_status === "FRAUD_ALERT").length);
      }

      // 4. Evaluasi CCTV
      if (cctvRes.data?.created_at) {
        setLatestCctvTime(new Date(cctvRes.data.created_at).toLocaleTimeString("id-ID"));
      }

      // 5. Transaksi Pending
      if (pendingRes.data) {
        setPendingTrxCount(pendingRes.data.length);
      }
    } catch (err: any) {
      console.error("Gagal mengambil telemetri:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 6000); // Polling otomatis tiap 6 detik
    return () => clearInterval(interval);
  }, []);

  // Eksekutor Aksi Perbaikan Sistem
  const executeRepair = async (action: string, label: string) => {
    setExecutingAction(action);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/devops/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deviceCode: "NITRO-01" })
      });

      const data = await res.json();
      const timeStr = new Date().toLocaleTimeString("id-ID");

      if (res.ok && data.success) {
        setActionFeedback({ type: "success", message: data.message });
        setActionLogs(prev => [`[${timeStr}] ✅ ${label}: ${data.message}`, ...prev.slice(0, 5)]);
        await fetchTelemetry(); // Refresh data segera
      } else {
        throw new Error(data.error || "Gagal mengeksekusi perbaikan.");
      }
    } catch (err: any) {
      setActionFeedback({ type: "error", message: err.message });
      const timeStr = new Date().toLocaleTimeString("id-ID");
      setActionLogs(prev => [`[${timeStr}] ❌ ${label}: ${err.message}`, ...prev.slice(0, 5)]);
    } finally {
      setExecutingAction(null);
    }
  };

  const isSystemAllGood = device?.isOnline && fraudCount === 0 && pendingTrxCount < 5;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* TOP BAR / NAVIGATION */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/owner"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Dashboard Owner
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Telemetry Sentinel
            </span>
          </div>

          <button
            onClick={() => { setRefreshing(true); fetchTelemetry(); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-xs transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Memperbarui..." : "Refresh Status"}
          </button>
        </div>

        {/* HERO STATUS BANNER */}
        <div className={`p-6 rounded-2xl border transition-all ${
          isSystemAllGood 
            ? "bg-emerald-950/30 border-emerald-500/30" 
            : "bg-amber-950/30 border-amber-500/30"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                {isSystemAllGood ? (
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-7 h-7 text-amber-400 animate-bounce" />
                )}
                <h1 className="text-xl md:text-2xl font-black tracking-tight">
                  {isSystemAllGood 
                    ? "SEMUA SISTEM LAPANGAN OPERASIONAL (100% HEALTHY)" 
                    : "PERHATIAN: DETEKSI ANOMALI ATAU PERANGKAT OFFLINE"}
                </h1>
              </div>
              <p className="text-xs text-slate-400 pl-9">
                Pemantauan kesehatan mesin ESP32, Solenoid, CCTV, dan Database Kasir Al-Kahfi secara terpadu.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800 text-xs">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Ping Database: <b>{dbLatency} ms</b></span>
            </div>
          </div>
        </div>

        {/* 4 CORE COMPONENT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* CARD 1: HARDWARE ESP32 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">IoT Solenoid Valve</h3>
              </div>
              {device?.isOnline ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Perangkat:</span>
                <span className="text-white font-mono font-semibold">{device?.code || "NITRO-01"}</span>
              </div>
              <div className="flex justify-between">
                <span>Mode Status:</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                  device?.status === "ACTIVE" ? "bg-amber-900/60 text-amber-300" :
                  device?.status === "LOCKED" ? "bg-rose-900/60 text-rose-300" :
                  "bg-slate-800 text-slate-200"
                }`}>
                  {device?.status || "IDLE"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Durasi Katup:</span>
                <span className="text-white font-semibold">{device?.activeDuration || 0} detik</span>
              </div>
              <div className="flex justify-between">
                <span>Heartbeat:</span>
                <span className={device?.isOnline ? "text-emerald-400" : "text-rose-400 font-bold"}>
                  {device?.diffSeconds !== undefined ? `${device.diffSeconds}s lalu` : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: SUPABASE CLOUD DATABASE */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Cloud Database</h3>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Connected
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Provider:</span>
                <span className="text-white font-semibold">Supabase Cloud</span>
              </div>
              <div className="flex justify-between">
                <span>Latency Ping:</span>
                <span className="text-emerald-400 font-mono font-semibold">{dbLatency} ms</span>
              </div>
              <div className="flex justify-between">
                <span>Transaksi Selesai:</span>
                <span className="text-white font-semibold">{todayTrxCount} nota hari ini</span>
              </div>
              <div className="flex justify-between">
                <span>Pending / Antrean:</span>
                <span className={pendingTrxCount > 0 ? "text-amber-400 font-semibold" : "text-slate-300"}>
                  {pendingTrxCount} transaksi
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3: CCTV & CLOUDINARY */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm">CCTV & Cloudinary</h3>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                Ready
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Edge Bridge:</span>
                <span className="text-white font-semibold">Armbian TV Box</span>
              </div>
              <div className="flex justify-between">
                <span>Cloud Storage:</span>
                <span className="text-white font-semibold">Cloudinary Free</span>
              </div>
              <div className="flex justify-between">
                <span>Snapshot Terakhir:</span>
                <span className="text-cyan-300 font-semibold">{latestCctvTime || "Standby Transaksi"}</span>
              </div>
              <div className="flex justify-between">
                <span>Koneksi POE:</span>
                <span className="text-white font-semibold">52V Port 1</span>
              </div>
            </div>
          </div>

          {/* CARD 4: ANTI-FRAUD & INTEGRITY */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Fraud Sentinel</h3>
              </div>
              {fraudCount === 0 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Zero Leakage
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  {fraudCount} Alert
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Status Audit:</span>
                <span className="text-emerald-400 font-semibold">100% Sinkron</span>
              </div>
              <div className="flex justify-between">
                <span>Kasus Fraud Hari Ini:</span>
                <span className={fraudCount > 0 ? "text-rose-400 font-bold" : "text-white"}>
                  {fraudCount} kasus
                </span>
              </div>
              <div className="flex justify-between">
                <span>Integritas Solenoid:</span>
                <span className="text-white font-semibold">Tercatat Kasir</span>
              </div>
              <div className="flex justify-between">
                <span>Bot Telegram:</span>
                <span className="text-indigo-300 font-semibold">@alkahfi_test_pos_bot</span>
              </div>
            </div>
          </div>

        </div>

        {/* EMERGENCY SELF-HEALING & REPAIR ACTION CENTER */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Pusat Perbaikan Mandiri & Pemulihan Sistem (DevOps Self-Healing Panel)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gunakan tombol kendali di bawah ini untuk memperbaiki kendala teknis lapangan secara instan tanpa perlu datang ke lokasi.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
              1-Click Remote Recovery
            </span>
          </div>

          {/* ACTION FEEDBACK ALERT */}
          {actionFeedback && (
            <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              actionFeedback.type === "success"
                ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/50 border-rose-500/40 text-rose-300"
            }`}>
              <div className="flex items-center gap-2">
                {actionFeedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{actionFeedback.message}</span>
              </div>
              <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100 text-sm">✕</button>
            </div>
          )}

          {/* COMMAND BUTTONS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">

            {/* BUTTON 1: RESET TO IDLE */}
            <button
              onClick={() => executeRepair("RESET_DEVICE_IDLE", "Reset Status IDLE")}
              disabled={Boolean(executingAction)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500 transition text-left group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition">
                <RefreshCw className={`w-4 h-4 ${executingAction === "RESET_DEVICE_IDLE" ? "animate-spin" : ""}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Reset Alat ke Normal (IDLE)</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Lepaskan status macet jika ESP32 menggantung di status ACTIVE.</p>
              </div>
            </button>

            {/* BUTTON 2: TEST PULSE SOLENOID */}
            <button
              onClick={() => executeRepair("TEST_PULSE_SOLENOID", "Uji Coba Katup Solenoid")}
              disabled={Boolean(executingAction)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500 transition text-left group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition">
                <Zap className={`w-4 h-4 ${executingAction === "TEST_PULSE_SOLENOID" ? "animate-pulse" : ""}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Uji Coba Katup 3 Detik</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Kirim pulsa buka-tutup relay untuk tes fisik solenoid di lapangan.</p>
              </div>
            </button>

            {/* BUTTON 3: CLEAR STUCK TRANSACTIONS */}
            <button
              onClick={() => executeRepair("CLEAR_STUCK_TRANSACTIONS", "Bersihkan Transaksi Gantung")}
              disabled={Boolean(executingAction)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500 transition text-left group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Bersihkan Transaksi Gantung</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Batalkan transaksi status PENDING yang menggantung &gt; 15 menit.</p>
              </div>
            </button>

            {/* BUTTON 4: RESOLVE FRAUD ALERTS */}
            <button
              onClick={() => executeRepair("RESOLVE_FRAUD_ALERTS", "Arsipkan Alert Fraud")}
              disabled={Boolean(executingAction)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500 transition text-left group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Selesaikan Alert Fraud</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Tutup semua notifikasi fraud palsu setelah diverifikasi aman.</p>
              </div>
            </button>

          </div>

          {/* AUDIT TRAIL LOGS */}
          {actionLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block mb-2">Riwayat Eksekusi Perbaikan:</span>
              <div className="space-y-1 font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                {actionLogs.map((log, i) => (
                  <div key={i} className="text-slate-300">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
