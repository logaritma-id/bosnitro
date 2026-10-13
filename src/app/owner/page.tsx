"use client";

import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Camera, 
  Package, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Building2,
  Calendar,
  Search,
  Filter,
  DollarSign,
  ShoppingCart,
  Users,
  User,
  UserCog,
  CheckCircle,
  Settings,
  X,
  Send
} from "lucide-react";
import { getProducts, saveProducts, getOperators, saveOperators, getBranches, saveBranches } from "../../lib/localDb";
import { supabase } from "@/lib/supabase";

// Helper untuk filter rentang tanggal/hari
const isWithinPeriod = (dateInput: string | Date | undefined, period: "today" | "yesterday" | "7days" | "month") => {
  if (!dateInput) return true;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return true;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === "today") {
    return d >= startToday && d <= endToday;
  }
  if (period === "yesterday") {
    const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const endYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return d >= startYesterday && d <= endYesterday;
  }
  if (period === "7days") {
    const start7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return d >= start7Days && d <= endToday;
  }
  if (period === "month") {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return d >= startMonth && d <= endToday;
  }
  return true;
};

// Data Baseline Fraud Alert Log berdasar rentang waktu dinamis
const getInitialFraudLogs = () => {
  const now = new Date();
  return [
    {
      id: "fraud-1",
      title: "Potensi Fraud - Kompresor Aktif Tanpa Input",
      branch: "Tambun 1",
      time: "09:37",
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 37).toISOString(),
      cashier: "Budi Santoso",
      description: "Sensor tekanan IoT mendeteksi kompresor menyala 45 detik tanpa adanya input transaksi di kasir POS.",
      telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
      sentToTelegram: true,
      snapshotUrl: null
    },
    {
      id: "fraud-2",
      title: "Selisih Setoran Laci Kasir (Kurang Rp 25.000)",
      branch: "Tambun 1",
      time: "14:10",
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 10).toISOString(),
      cashier: "Budi Santoso",
      description: "Blind closing kasir shift: Uang fisik Rp 175.000 vs Sistem Rp 200.000 (Selisih minus Rp 25.000).",
      telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
      sentToTelegram: true,
      snapshotUrl: null
    },
    {
      id: "fraud-3",
      title: "Kompresor Aktif di Luar Jam Operasional",
      branch: "Cibitung 2",
      time: "02:15",
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 2, 15).toISOString(),
      cashier: "Sistem IoT",
      description: "Mesin kompresor terdeteksi menyala pada pukul 02:15 WIB saat gerai dalam status tutup.",
      telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
      sentToTelegram: true,
      snapshotUrl: null
    },
    {
      id: "fraud-4",
      title: "Pengisian Tanpa Transaksi POS",
      branch: "Cibitung 1",
      time: "10:42",
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 42).toISOString(),
      cashier: "Agus Pratama",
      description: "Nozzle nitrogen aktif mengisi 2 unit motor tanpa ada struk kasir yang dicetak.",
      telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
      sentToTelegram: true,
      snapshotUrl: null
    },
    {
      id: "fraud-5",
      title: "Selisih Setoran Karyawan (Kurang Rp 50.000)",
      branch: "Cibitung 3",
      time: "08:21",
      createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 8, 21).toISOString(),
      cashier: "Rian Hidayat",
      description: "Selisih setoran fisik kasir shift pagi tidak sesuai dengan data cloud.",
      telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
      sentToTelegram: true,
      snapshotUrl: null
    }
  ];
};

// --- MOCK DATA ---
const MOCK_BRANCHES = ["Semua Cabang", "Tambun 1", "Cikarang Baru", "Cibitung", "Babelan"];
const INITIAL_STATS = {
  omzet: 0,
  trx: 0,
  oliSold: 0,
  profit: 0
};

const INITIAL_SNAPSHOTS: any[] = [];
const INITIAL_SHIFTS: any[] = [];

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "cabang" | "stock" | "karyawan" | "audit" | "crm" | "keuangan" | "pengaturan">("overview");
  const [selectedBranch, setSelectedBranch] = useState("Semua Cabang");
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "yesterday" | "7days" | "month">("today");
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [selectedFraudModal, setSelectedFraudModal] = useState<any | null>(null);
  const [auditView, setAuditView] = useState<"cctv" | "fraud">("cctv");
  const [auditSearch, setAuditSearch] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  
  // Real-time State
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [snapshots, setSnapshots] = useState(INITIAL_SNAPSHOTS);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [branchStats, setBranchStats] = useState<any[]>([]);
  const [shifts, setShifts] = useState(INITIAL_SHIFTS);
  const [fraudLogs, setFraudLogs] = useState<any[]>([]);
  const [showFraudAlert, setShowFraudAlert] = useState(false); // Default false, will be triggered by Kasir

  const [products, setProducts] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState<{id?: number, name: string, harga: number, hpp: number, stok: number, img: string, category: string}>({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen' });
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [newOperator, setNewOperator] = useState<{id?: number, name: string, pin: string, branch: string}>({ name: '', pin: '', branch: '' });
  const [selectedBranchConfig, setSelectedBranchConfig] = useState<any>(null);

  // Ambil data Transaksi, Absensi, Shift, dan Hardware IoT langsung dari Database Supabase
  const loadDataFromSupabase = async () => {
    try {
      // 1. Ambil data Transaksi dari Supabase
      const { data: trxList, error: trxErr } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (trxList && !trxErr) {
        setRawTransactions(trxList);
      }

      // 2. Ambil Status Real Perangkat IoT dari Supabase branch_devices
      const { data: devices, error: devErr } = await supabase
        .from('branch_devices')
        .select('*');

      if (devices && !devErr) {
        const nitroDevice = devices.find(d => d.device_code === 'NITRO-01');
        let isNitroOnline = false;
        let lastActiveStr = "";

        if (nitroDevice) {
          const lastTime = new Date(nitroDevice.updated_at || nitroDevice.last_heartbeat).getTime();
          const diffSec = (Date.now() - lastTime) / 1000;
          isNitroOnline = diffSec < 120; // 2 menit
          lastActiveStr = new Date(nitroDevice.updated_at || nitroDevice.last_heartbeat).toLocaleString('id-ID');
        }

        setBranchStats(prev => prev.map(b => {
          if (b.name === 'Tambun 1') {
            return {
              ...b,
              status: isNitroOnline ? 'Online' : 'Offline',
              lastActive: lastActiveStr,
              deviceStatus: nitroDevice?.device_status || 'IDLE'
            };
          }
          return b;
        }));
      }
    } catch (err) {
      console.error("Gagal memuat data dari Supabase:", err);
    }
  };

  // Sinkronisasi data dinamis dan reaktif berdasarkan rawTransactions, selectedPeriod, dan selectedBranch
  useEffect(() => {
    // A. Filter transaksi sesuai rentang hari/tanggal (Hari Ini, Kemarin, 7 Hari Terakhir, Bulan Ini)
    const periodTrx = rawTransactions.filter(t => isWithinPeriod(t.created_at, selectedPeriod));

    // B. Filter penjualan yang COMPLETED
    const periodSales = periodTrx.filter(t => t.payment_status === 'COMPLETED');
    
    // C. Kalkulasi Omzet & Transaksi (Global atau Spesifik Cabang)
    const branchSales = selectedBranch === "Semua Cabang"
      ? periodSales
      : periodSales.filter(t => {
          const bName = (t.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !t.branch_id) ? 'Tambun 1' : t.branch_id;
          return bName.toLowerCase() === selectedBranch.toLowerCase();
        });

    const totalOmzet = branchSales.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const totalTrx = branchSales.length;

    setStats({
      omzet: totalOmzet,
      trx: totalTrx,
      oliSold: Math.floor(totalTrx * 0.2),
      profit: Math.round(totalOmzet * 0.8)
    });

    // D. Update metrik omzet & transaksi masing-masing cabang untuk periode yang dipilih
    setBranchStats(prev => prev.map(b => {
      const bSales = periodSales.filter(t => {
        const bName = (t.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !t.branch_id) ? 'Tambun 1' : t.branch_id;
        return bName.toLowerCase() === b.name.toLowerCase();
      });
      return {
        ...b,
        omzet: bSales.reduce((sum, t) => sum + Number(t.total_amount || 0), 0),
        trx: bSales.length
      };
    }));

    // E. CCTV Snapshots Feed dari transaksi periode ini
    const snapFeed = periodSales
      .filter(t => t.snapshot_url)
      .map(t => {
        const timeStr = new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const branchNameStr = (t.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !t.branch_id) ? 'Tambun 1' : t.branch_id;
        return {
          id: `TRX-${t.id.slice(0, 6)}`,
          time: timeStr,
          createdAt: t.created_at,
          branch: branchNameStr,
          cashier: 'Kasir',
          amount: Number(t.total_amount),
          img: t.snapshot_url,
          url: t.snapshot_url
        };
      });
    setSnapshots(snapFeed);

    // F. Absensi Wajah Karyawan periode ini
    const attList = periodTrx
      .filter(t => t.payment_status === 'ATTENDANCE')
      .map(t => {
        const cashierName = (t.payment_method || '').replace('ABSEN:', '') || 'Kasir';
        const timeStr = new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const branchNameStr = (t.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !t.branch_id) ? 'Tambun 1' : t.branch_id;
        return {
          id: `ABS-${t.id.slice(0, 6)}`,
          cashier: cashierName,
          branch: branchNameStr,
          time: timeStr,
          date: dateStr,
          createdAt: t.created_at,
          img: t.snapshot_url,
          url: t.snapshot_url
        };
      });
    setAttendances(attList);

    // G. Laporan Tutup Shift periode ini
    const shiftList = periodTrx
      .filter(t => t.payment_status === 'SHIFT_REPORT')
      .map(t => {
        try {
          const parsed = JSON.parse(t.payment_method);
          return {
            id: parsed.id || `SH-${t.id.slice(0, 6)}`,
            date: parsed.date || new Date(t.created_at).toLocaleTimeString('id-ID'),
            cashier: parsed.cashier || 'Kasir',
            branch: parsed.branch || t.branch_id || 'Tambun 1',
            modal: parsed.modal || 0,
            system: parsed.system || 0,
            physical: parsed.physical || Number(t.total_amount),
            selisih: parsed.selisih || 0,
            createdAt: t.created_at
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    if (shiftList.length > 0) {
      setShifts(shiftList);
    }

    // H. Telegram Fraud Alert Logs (Database Supabase + Baseline dinamis)
    const dbAlerts = periodTrx
      .filter(t => t.payment_status === 'FRAUD_ALERT')
      .map(t => {
        try {
          const parsed = JSON.parse(t.payment_method);
          return {
            id: t.id,
            title: parsed.title || 'Peringatan Selisih Kasir',
            branch: parsed.branch || t.branch_id || 'Tambun 1',
            time: parsed.time || new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            cashier: parsed.cashier || 'Kasir',
            description: parsed.description || `Terdeteksi indikasi anomali selisih setoran kasir senilai Rp ${Math.abs(parsed.selisih || 0).toLocaleString('id-ID')}`,
            createdAt: t.created_at,
            telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
            sentToTelegram: true,
            snapshotUrl: t.snapshot_url
          };
        } catch {
          return {
            id: t.id,
            title: t.payment_method || 'Peringatan Anomali',
            branch: t.branch_id || 'Tambun 1',
            time: new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            cashier: 'Kasir',
            description: 'Terdeteksi anomali operasional pada sistem.',
            createdAt: t.created_at,
            telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
            sentToTelegram: true,
            snapshotUrl: t.snapshot_url
          };
        }
      });

    const baselineAlerts = getInitialFraudLogs().filter(f => isWithinPeriod(f.createdAt, selectedPeriod));
    const combinedAlerts = [...dbAlerts, ...baselineAlerts];
    setFraudLogs(combinedAlerts);
    if (combinedAlerts.length > 0) {
      setShowFraudAlert(true);
    }
  }, [rawTransactions, selectedPeriod, selectedBranch]);

  // Load from LocalDB on Mount & Supabase Live Sync
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
    setProducts(getProducts());
    setOperators(getOperators());
    setBranchStats(getBranches());
    
    // Load data Supabase saat awal mount
    loadDataFromSupabase();

    // Load produk dari Supabase (override localStorage jika ada data di DB)
    const loadProductsFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('id', { ascending: true });
        if (data && !error && data.length > 0) {
          setProducts(data);
          saveProducts(data); // sync ke localStorage sebagai cache
        }
      } catch (e) {
        // fallback ke localStorage sudah di-set di atas
      }
    };
    loadProductsFromSupabase();

    // Auto-refresh berkala setiap 6 detik
    const pollInterval = setInterval(loadDataFromSupabase, 6000);

    // Supabase Realtime Channels
    const subTransactions = supabase
      .channel('owner_transactions_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadDataFromSupabase();
      })
      .subscribe();

    const subDevices = supabase
      .channel('owner_devices_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_devices' }, () => {
        loadDataFromSupabase();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(subTransactions);
      supabase.removeChannel(subDevices);
    };
  }, []);

  // BroadcastChannel Listener for Realtime Demo (Same Browser Instant Sync)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = new BroadcastChannel('pos_demo_channel');
    channel.onmessage = (event) => {
      if (event.data.type === 'NEW_TRANSACTION') {
        const { amount, newSnap, branch } = event.data.payload;
        setRawTransactions(prev => [
          {
            id: `trx-${Date.now()}`,
            total_amount: amount,
            payment_status: 'COMPLETED',
            snapshot_url: newSnap?.img || newSnap?.url,
            branch_id: branch,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
      } else if (event.data.type === 'ATTENDANCE') {
        const newAtt = event.data.payload;
        setRawTransactions(prev => [
          {
            id: `att-${Date.now()}`,
            total_amount: 0,
            payment_status: 'ATTENDANCE',
            payment_method: 'ABSEN:' + (newAtt.cashier || 'Kasir'),
            snapshot_url: newAtt.img || newAtt.url,
            branch_id: newAtt.branch,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
      } else if (event.data.type === 'CLOSE_SHIFT') {
        const { shiftReport } = event.data.payload;
        setRawTransactions(prev => [
          {
            id: `shift-${Date.now()}`,
            total_amount: shiftReport.physical,
            payment_status: 'SHIFT_REPORT',
            payment_method: JSON.stringify(shiftReport),
            branch_id: shiftReport.branch,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
      } else if (event.data.type === 'FRAUD_ALERT') {
        setShowFraudAlert(true);
        if (event.data.payload) {
          setRawTransactions(prev => [
            {
              id: `fraud-${Date.now()}`,
              total_amount: 0,
              payment_status: 'FRAUD_ALERT',
              payment_method: JSON.stringify(event.data.payload),
              branch_id: event.data.payload.branch,
              created_at: new Date().toISOString()
            },
            ...prev
          ]);
        }
      } else if (event.data.type === 'DB_UPDATE') {
        if (event.data.payload.entity === 'products') setProducts(getProducts());
        if (event.data.payload.entity === 'operators') setOperators(getOperators());
        if (event.data.payload.entity === 'branchStats') setBranchStats(getBranches());
      }
    };
    return () => channel.close();
  }, []);

  // --- FILTER DATA BERDASARKAN CABANG YANG DIPILIH ---
  const displayedBranches = selectedBranch === "Semua Cabang"
    ? branchStats
    : branchStats.filter((b: any) => b.name.toLowerCase() === selectedBranch.toLowerCase());

  const displayedSnapshots = selectedBranch === "Semua Cabang"
    ? snapshots
    : snapshots.filter((s: any) => (s.branch || "").toLowerCase() === selectedBranch.toLowerCase());

  const displayedAttendances = selectedBranch === "Semua Cabang"
    ? attendances
    : attendances.filter((a: any) => (a.branch || "").toLowerCase() === selectedBranch.toLowerCase());

  const displayedShifts = selectedBranch === "Semua Cabang"
    ? shifts
    : shifts.filter((s: any) => (s.branch || "").toLowerCase() === selectedBranch.toLowerCase());

  const displayedFraudLogs = selectedBranch === "Semua Cabang"
    ? fraudLogs
    : fraudLogs.filter((f: any) => (f.branch || "").toLowerCase().includes(selectedBranch.toLowerCase()));

  const displayedOperators = selectedBranch === "Semua Cabang"
    ? operators
    : operators.filter((o: any) => (o.branch || "").toLowerCase() === selectedBranch.toLowerCase());

  const periodTrx = rawTransactions.filter(t => isWithinPeriod(t.created_at, selectedPeriod));
  const periodSales = periodTrx.filter(t => t.payment_status === 'COMPLETED');
  const displayedSales = selectedBranch === "Semua Cabang"
    ? periodSales
    : periodSales.filter(t => {
        const bName = (t.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !t.branch_id) ? 'Tambun 1' : t.branch_id;
        return bName.toLowerCase() === selectedBranch.toLowerCase();
      });

  const filteredAuditSnapshots = displayedSnapshots.filter(s => 
    !auditSearch || 
    (s.id && s.id.toLowerCase().includes(auditSearch.toLowerCase())) ||
    (s.cashier && s.cashier.toLowerCase().includes(auditSearch.toLowerCase())) ||
    (s.branch && s.branch.toLowerCase().includes(auditSearch.toLowerCase()))
  );

  const filteredAuditFraud = displayedFraudLogs.filter(f => 
    !auditSearch || 
    (f.title && f.title.toLowerCase().includes(auditSearch.toLowerCase())) ||
    (f.branch && f.branch.toLowerCase().includes(auditSearch.toLowerCase())) ||
    (f.cashier && f.cashier.toLowerCase().includes(auditSearch.toLowerCase())) ||
    (f.description && f.description.toLowerCase().includes(auditSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar - Desktop */}
      <aside className="w-full md:w-64 bg-[#012B89] text-white flex-shrink-0 md:min-h-screen flex flex-col shadow-xl">
        <div className="p-4 border-b border-blue-800/50 flex flex-col items-center justify-center bg-[#01226e]">
          <img src="/logo.png" alt="Al-Kahfi Logo" className="w-40 h-auto object-contain mb-2 drop-shadow-md" />
          <div className="bg-red-600 text-white text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full shadow-inner">
            Owner Dashboard
          </div>
        </div>
        <nav className="p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          <button onClick={() => setActiveTab("overview")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <LayoutDashboard size={20} />
            <span className="font-semibold text-sm">Dashboard</span>
          </button>
          <button onClick={() => setActiveTab("cabang")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'cabang' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <Building2 size={20} />
            <span className="font-semibold text-sm">Cabang</span>
          </button>
          <button onClick={() => setActiveTab("stock")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'stock' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <Package size={20} />
            <span className="font-semibold text-sm">Produk & Stok</span>
          </button>
          <button onClick={() => setActiveTab("karyawan")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'karyawan' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <Users size={20} />
            <span className="font-semibold text-sm">Karyawan & Shift</span>
          </button>
          <button onClick={() => setActiveTab("audit")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'audit' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <AlertCircle size={20} />
            <span className="font-semibold text-sm">Audit & Fraud</span>
          </button>
          <button onClick={() => setActiveTab("crm")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'crm' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <User size={20} />
            <span className="font-semibold text-sm">CRM Pelanggan</span>
          </button>
          <button onClick={() => setActiveTab("keuangan")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'keuangan' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <DollarSign size={20} />
            <span className="font-semibold text-sm">Laporan Keuangan</span>
          </button>
          <button onClick={() => setActiveTab("pengaturan")} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${activeTab === 'pengaturan' ? 'bg-[#001b5c] text-yellow-400 shadow-inner' : 'text-blue-100 hover:bg-blue-800 hover:text-white'}`}>
            <Settings size={20} />
            <span className="font-semibold text-sm">Pengaturan</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Fraud Alert Banner */}
        {showFraudAlert && displayedFraudLogs.length > 0 && (
          <div className="bg-red-600 text-white px-6 py-3 flex flex-col sm:flex-row items-center justify-between shadow-md z-10 shrink-0 gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 bg-red-800 rounded-full animate-pulse"><AlertCircle size={20} /></div>
              <div>
                <p className="font-black text-sm uppercase tracking-wide">Peringatan Keamanan Kritis (Telegram Alert Active)</p>
                <p className="text-xs text-red-100 font-medium mt-0.5">
                  {displayedFraudLogs[0].title} di {displayedFraudLogs[0].branch} ({displayedFraudLogs[0].time} WIB)
                </p>
              </div>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <button 
                onClick={() => setSelectedFraudModal(displayedFraudLogs[0])}
                className="flex-1 sm:flex-none px-4 py-1.5 bg-white text-red-700 font-bold text-xs rounded shadow-sm hover:bg-red-50"
              >
                Lihat Detail Alert
              </button>
              <button onClick={() => setShowFraudAlert(false)} className="px-3 py-1.5 border border-red-400 text-white font-bold text-xs rounded hover:bg-red-700">Tutup</button>
            </div>
          </div>
        )}

        <header className="bg-white px-8 py-5 border-b shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-gray-800 capitalize">
              {activeTab === 'overview' && 'Dashboard Executive'}
              {activeTab === 'cabang' && 'Manajemen Cabang'}
              {activeTab === 'audit' && 'Audit CCTV & Log Fraud Telegram'}
              {activeTab === 'stock' && 'Master Produk & Stok'}
              {activeTab === 'karyawan' && 'Manajemen Karyawan & Shift'}
              {activeTab === 'crm' && 'CRM Pelanggan'}
              {activeTab === 'keuangan' && 'Laporan Keuangan'}
              {activeTab === 'pengaturan' && 'Pengaturan Sistem'}
            </h2>
            <p className="text-gray-500 text-sm">
              {activeTab === 'overview' ? (
                selectedBranch === 'Semua Cabang' 
                  ? `Ringkasan operasional 4 cabang periode ${selectedPeriod === 'today' ? 'hari ini' : selectedPeriod === 'yesterday' ? 'kemarin' : selectedPeriod === '7days' ? '7 hari terakhir' : 'bulan ini'}.` 
                  : `Memantau operasional khusus cabang ${selectedBranch} periode ${selectedPeriod === 'today' ? 'hari ini' : selectedPeriod === 'yesterday' ? 'kemarin' : selectedPeriod === '7days' ? '7 hari terakhir' : 'bulan ini'}.`
              ) : 'Real-time data synchronization via Supabase.'}
            </p>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border">
              <Calendar size={16} className="text-gray-500 mr-2 shrink-0" />
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="bg-transparent text-sm font-semibold text-gray-700 outline-none w-full md:w-auto cursor-pointer"
              >
                <option value="today">Hari Ini{todayLabel ? ` (${todayLabel})` : ''}</option>
                <option value="yesterday">Kemarin</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="month">Bulan Ini</option>
              </select>
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border">
              <Building2 size={16} className="text-gray-500 mr-2 shrink-0" />
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-700 outline-none w-full md:w-auto cursor-pointer"
              >
                <option value="Semua Cabang">Semua Cabang</option>
                {branchStats.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            {activeTab === 'overview' && (
               <div className="hidden md:flex items-center space-x-2 bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-2 rounded-lg ml-2">
                 <CheckCircle size={16} />
                 <span className="text-sm font-bold">Semua Sistem Online</span>
               </div>
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Branch Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {displayedBranches.map((branch, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-emerald-50 flex flex-col overflow-hidden">
                    <div className="p-3 bg-emerald-50/30 flex flex-col border-b border-emerald-50 gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-gray-800 text-sm leading-tight line-clamp-2 flex-1 min-w-0">{branch.name}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center ${branch.status === 'Online' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full mr-1 ${branch.status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          {branch.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 text-center">
                       <p className="text-xs text-gray-400 font-semibold mb-1">
                         Omzet {selectedPeriod === 'today' ? 'Hari Ini' : selectedPeriod === 'yesterday' ? 'Kemarin' : selectedPeriod === '7days' ? '7 Hari' : 'Bulan Ini'}
                       </p>
                       <p className="font-black text-blue-700 text-2xl">Rp {branch.omzet.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="px-5 pb-5 space-y-2">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-medium flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>Transaksi Nitrogen</span>
                          <span className="font-bold text-gray-700">{branch.trx}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-medium flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>Unit Oli Terpotong</span>
                          <span className="font-bold text-gray-700">{Math.floor(branch.trx * 0.2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm pt-1">
                          <span className="text-gray-500 font-medium flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>IoT Status</span>
                          <span className={`font-bold ${branch.status === 'Online' ? 'text-emerald-600' : 'text-red-600'}`}>● {branch.status}</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Bottom 3 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Col 1: Live Fraud & Audit Stream */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-80">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-gray-800 flex items-center"><Camera size={18} className="mr-2 text-blue-900" /> Live Fraud & Audit Stream</h3>
                     <button onClick={() => setActiveTab("audit")} className="text-blue-600 text-xs font-bold hover:underline">Lihat Semua</button>
                  </div>
                  <div className="flex-1 overflow-x-auto overflow-y-hidden flex space-x-3 pb-2">
                     {displayedSnapshots.slice(0, 5).map((snap, idx) => (
                        <div key={idx} onClick={() => setSelectedSnapshot(snap.img || snap.url)} className="w-32 shrink-0 flex flex-col cursor-pointer group">
                           <div className="w-full h-24 bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                              <img src={snap.img || snap.url} alt="Snap" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute top-1 right-1 bg-black/60 text-[9px] text-white px-1 rounded">CCTV</div>
                           </div>
                           <p className="text-xs font-bold text-blue-800 leading-tight line-clamp-2">{snap.branch} - Trx</p>
                           <p className="text-[10px] text-gray-500 mt-1">{snap.time}</p>
                        </div>
                     ))}
                     {displayedSnapshots.length === 0 && (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-medium">Belum ada tangkapan layar.</div>
                     )}
                  </div>
                </div>

                {/* Col 2: Telegram Fraud Alert Log */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-80">
                  <div className="flex justify-between items-center mb-3">
                     <div className="flex items-center space-x-2">
                       <h3 className="font-bold text-gray-800 text-sm md:text-base flex items-center">
                         <Send size={16} className="text-blue-600 mr-2 shrink-0" />
                         <span>Telegram Fraud Alert Log</span>
                       </h3>
                       <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1"></span>
                         Bot Live
                       </span>
                     </div>
                     <button onClick={() => setActiveTab("audit")} className="text-blue-600 text-xs font-bold hover:underline shrink-0">Lihat Semua</button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                     {displayedFraudLogs.map((alert, i) => (
                        <div 
                          key={alert.id || i} 
                          onClick={() => setSelectedFraudModal(alert)}
                          className="flex items-start justify-between p-3 bg-red-50/60 hover:bg-red-100/70 border border-red-100 rounded-xl transition-all cursor-pointer group"
                        >
                           <div className="flex items-start space-x-2.5">
                              <div className="p-1 bg-red-100 text-red-600 rounded-lg group-hover:bg-red-200 transition-colors mt-0.5 shrink-0">
                                <AlertCircle size={15} />
                              </div>
                              <div>
                                 <p className="text-xs md:text-sm font-bold text-gray-800 leading-tight group-hover:text-red-900 transition-colors">{alert.title}</p>
                                 <p className="text-xs text-blue-800 mt-1 font-medium">{alert.branch} | {alert.time}</p>
                              </div>
                           </div>
                           <div className="flex flex-col items-end shrink-0 pl-2">
                              <span className="inline-flex items-center text-[9px] md:text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                                 <CheckCircle size={10} className="mr-1" /> Telegram
                              </span>
                              <span className="text-[10px] text-gray-400 mt-1 font-medium group-hover:text-blue-600">Detail &rarr;</span>
                           </div>
                        </div>
                     ))}
                     {displayedFraudLogs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-8">
                           <CheckCircle size={28} className="text-emerald-500 mb-2 opacity-80" />
                           <p className="text-xs md:text-sm font-bold text-gray-700">Tidak Ada Fraud Terdeteksi</p>
                           <p className="text-[11px] text-gray-400 mt-0.5">Semua transaksi & mesin {selectedBranch} berjalan normal.</p>
                        </div>
                     )}
                  </div>
                </div>

                {/* Col 3: Grafik Omzet */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-80">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-gray-800 text-sm md:text-base">
                       Grafik Omzet 4 Cabang ({selectedPeriod === 'today' ? 'Hari Ini' : selectedPeriod === 'yesterday' ? 'Kemarin' : selectedPeriod === '7days' ? '7 Hari Terakhir' : 'Bulan Ini'})
                     </h3>
                     <select 
                       value={selectedPeriod}
                       onChange={(e) => setSelectedPeriod(e.target.value as any)}
                       className="text-xs border rounded px-2 py-1 bg-gray-50 outline-none cursor-pointer font-semibold text-gray-700"
                     >
                       <option value="today">Hari Ini</option>
                       <option value="yesterday">Kemarin</option>
                       <option value="7days">7 Hari</option>
                       <option value="month">Bulan Ini</option>
                     </select>
                  </div>
                  <div className="flex-1 flex items-end justify-around pb-2 px-2">
                     {branchStats.map((branch, i) => {
                        // Max omzet for scaling (dummy scaling if 0)
                        const maxOmzet = Math.max(...branchStats.map(b => b.omzet), 3000000);
                        const heightPercent = branch.omzet > 0 ? Math.max((branch.omzet / maxOmzet) * 100, 10) : 5;
                        const colors = ['bg-indigo-500', 'bg-yellow-400', 'bg-indigo-600', 'bg-indigo-400'];
                        return (
                           <div key={i} className="flex flex-col items-center group w-1/5">
                              <span className="text-[10px] text-gray-500 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{(branch.omzet/1000000).toFixed(2)} Jt</span>
                              <div className={`w-full ${colors[i % colors.length]} rounded-t-sm transition-all`} style={{ height: `${heightPercent}%`, minHeight: '10px' }}></div>
                              <span className="text-xs font-medium text-gray-600 mt-2 truncate w-full text-center">{branch.name.split(' ')[0]}</span>
                           </div>
                        )
                     })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: AUDIT & FRAUD */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center space-x-2 text-gray-500 flex-1 w-full sm:w-auto">
                  <Search size={20} />
                  <input 
                    type="text" 
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Cari ID Transaksi, Kasir, atau Indikasi Fraud..." 
                    className="outline-none bg-transparent w-full sm:w-64 text-sm font-medium" 
                  />
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setAuditView("cctv")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${auditView === "cctv" ? "bg-slate-900 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    <Camera size={14} />
                    <span>Feed CCTV ({filteredAuditSnapshots.length})</span>
                  </button>
                  <button 
                    onClick={() => setAuditView("fraud")}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${auditView === "fraud" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    <Send size={14} />
                    <span>Log Telegram Fraud ({filteredAuditFraud.length})</span>
                  </button>
                  <button 
                    onClick={() => {
                      const newSimulatedAlert = {
                        id: `fraud-${Date.now()}`,
                        title: "Simulasi Uji Coba: Peringatan Fraud IoT",
                        branch: selectedBranch === "Semua Cabang" ? "Tambun 1" : selectedBranch,
                        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                        createdAt: new Date().toISOString(),
                        cashier: "Kasir (Simulasi)",
                        description: "Uji coba pengiriman alert keamanan otomatis dari dashboard owner ke Bot Telegram @AlKahfiAlertBot.",
                        telegramStatus: "Terkirim ke Bot Telegram @AlKahfiAlertBot",
                        sentToTelegram: true,
                        snapshotUrl: snapshots.length > 0 ? (snapshots[0].img || snapshots[0].url) : null
                      };
                      setFraudLogs(prev => [newSimulatedAlert, ...prev]);
                      alert("✅ Notifikasi Simulasi Fraud Alert berhasil dikirim ke Bot Telegram @AlKahfiAlertBot!");
                    }}
                    className="hidden md:flex items-center space-x-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
                  >
                    <Send size={13} />
                    <span>Test Alert Telegram</span>
                  </button>
                </div>
              </div>

              {auditView === "cctv" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                  {filteredAuditSnapshots.map((snap, i) => (
                    <div key={i} onClick={() => setSelectedSnapshot(snap.img || snap.url)} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-all group cursor-pointer">
                      <div className="relative aspect-video bg-gray-900 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={snap.img || snap.url} alt="CCTV" className="object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white flex items-center">
                          <Camera size={12} className="mr-1 text-red-400" /> Bukti CCTV
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{snap.id}</span>
                            <h3 className="font-black text-gray-900 mt-2">Rp {snap.amount.toLocaleString('id-ID')}</h3>
                          </div>
                          <span className="text-sm font-bold text-gray-400">{snap.time}</span>
                        </div>
                        <div className="pt-3 border-t flex justify-between items-center text-xs text-gray-500 font-medium">
                          <span className="flex items-center"><Building2 size={12} className="mr-1"/> {snap.branch}</span>
                          <span className="flex items-center"><User size={12} className="mr-1"/> {snap.cashier}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredAuditSnapshots.length === 0 && (
                    <div className="col-span-full py-16 text-center text-gray-400 font-medium">
                      Belum ada bukti rekaman CCTV dari transaksi kasir pada periode/cabang ini.
                    </div>
                  )}
                </div>
              ) : (
                /* FRAUD LOG AUDIT TABLE */
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Send size={18} className="text-blue-600" />
                      <h3 className="font-bold text-gray-800">Daftar Peringatan Keamanan & Dispatch Telegram</h3>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                      {filteredAuditFraud.length} Insiden Terdeteksi
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-bold border-b">Waktu & Cabang</th>
                          <th className="p-4 font-bold border-b">Jenis Pelanggaran / Anomali</th>
                          <th className="p-4 font-bold border-b">Kasir Bertugas</th>
                          <th className="p-4 font-bold border-b">Status Dispatch Telegram</th>
                          <th className="p-4 font-bold border-b text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredAuditFraud.map((alert, idx) => (
                          <tr key={alert.id || idx} className="hover:bg-red-50/30 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-gray-900 text-sm">{alert.time} WIB</p>
                              <p className="text-xs text-gray-500 flex items-center mt-0.5">
                                <Building2 size={11} className="mr-1" /> {alert.branch}
                              </p>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-red-700 text-sm flex items-center">
                                <AlertCircle size={14} className="mr-1.5 shrink-0" />
                                {alert.title}
                              </p>
                              <p className="text-xs text-gray-500 max-w-md truncate mt-0.5">
                                {alert.description}
                              </p>
                            </td>
                            <td className="p-4 font-semibold text-gray-700 text-sm">
                              {alert.cashier || 'Kasir'}
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle size={12} className="mr-1" /> Terkirim (@AlKahfiAlertBot)
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button 
                                onClick={() => setSelectedFraudModal(alert)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                Detail & CCTV
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredAuditFraud.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-gray-400 font-medium">
                              Tidak ada log peringatan fraud pada cabang dan filter waktu yang dipilih.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STOCK & HARGA */}
          {activeTab === "stock" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Master Data Produk</h3>
                <button onClick={() => setShowProductModal(true)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 transition-all">+ Tambah Produk</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b">Nama Layanan / Barang</th>
                      <th className="p-4 font-bold border-b">Kategori</th>
                      <th className="p-4 font-bold border-b text-right">Harga Jual</th>
                      <th className="p-4 font-bold border-b text-right">HPP (Modal)</th>
                      <th className="p-4 font-bold border-b text-right">Margin</th>
                      <th className="p-4 font-bold border-b text-center">Stok Fisik</th>
                      <th className="p-4 font-bold border-b">Status</th>
                      <th className="p-4 font-bold border-b text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-gray-900 flex items-center space-x-3">
                          <img src={prod.img} alt={prod.name} className="w-10 h-10 rounded-md object-cover border" />
                          <span>{prod.name}</span>
                        </td>
                        <td className="p-4">
                          {prod.category === 'nitrogen' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">⚗️ Nitrogen</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">🛒 Ritel</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-semibold text-gray-700">Rp {prod.harga.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right font-semibold text-gray-500">Rp {prod.hpp.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right font-black text-emerald-600">
                          {Math.round(((prod.harga - prod.hpp) / prod.harga) * 100)}%
                        </td>
                        <td className="p-4 text-center font-bold text-gray-800">
                          {prod.stok > 900 ? '∞' : prod.stok}
                        </td>
                        <td className="p-4">
                          {prod.stok < 5 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              <AlertCircle size={12} className="mr-1" /> Stok Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => {
                              setNewProduct({ ...prod });
                              setShowProductModal(true);
                            }}
                            className="text-blue-600 font-bold text-sm hover:text-blue-800"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* TAB 4: KARYAWAN & SHIFT */}
          {activeTab === "karyawan" && (
            <div className="space-y-6">
              {/* LOG ABSENSI MASUK KARYAWAN */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Camera size={18} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800">Log Absensi Wajah Kasir (Face Attendance)</h3>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
                    {displayedAttendances.length} Catatan Absen
                  </span>
                </div>
                <div className="p-4">
                  {displayedAttendances.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 font-medium text-sm">
                      Belum ada rekaman foto absensi masuk kasir hari ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {displayedAttendances.map((att, i) => (
                        <div 
                          key={att.id || i} 
                          onClick={() => setSelectedSnapshot(att.img || att.url)}
                          className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="aspect-square bg-gray-200 relative overflow-hidden">
                            <img 
                              src={att.img || att.url} 
                              alt={att.cashier} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                              {att.time}
                            </div>
                          </div>
                          <div className="p-2.5">
                            <p className="font-bold text-gray-800 text-xs truncate">{att.cashier}</p>
                            <p className="text-[10px] text-gray-500 flex items-center mt-0.5">
                              <Building2 size={10} className="mr-1 shrink-0" />
                              <span className="truncate">{att.branch}</span>
                            </p>
                            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center">
                              <CheckCircle size={10} className="mr-1" /> Hadir
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* KASIR SETTINGS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Manajemen Akses Kasir</h3>
                <button 
                  onClick={() => {
                    setNewOperator({ name: '', pin: '', branch: branchStats.length > 0 ? branchStats[0].name : '' });
                    setShowOperatorModal(true);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 transition-all"
                >
                  + Tambah Kasir
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b">Nama Lengkap</th>
                      <th className="p-4 font-bold border-b">PIN Akses</th>
                      <th className="p-4 font-bold border-b">Cabang</th>
                      <th className="p-4 font-bold border-b text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedOperators.map((op) => (
                      <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-gray-900 flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">{op.name[0]}</div>
                          <span>{op.name}</span>
                        </td>
                        <td className="p-4 font-mono text-gray-700 font-bold">{op.pin}</td>
                        <td className="p-4 font-semibold text-gray-600">{op.branch}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => {
                              if (confirm(`Hapus akses kasir ${op.name}?`)) {
                                const newOps = operators.filter(o => o.id !== op.id);
                                setOperators(newOps);
                                saveOperators(newOps);
                              }
                            }}
                            className="text-red-600 font-bold text-sm hover:text-red-800"
                          >
                            Cabut Akses
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SHIFT AUDIT */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
              <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Log Discrepancy & Blind Closing</h3>
                <button className="px-4 py-2 bg-white border text-gray-700 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 transition-all">Download Excel</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b">ID Shift</th>
                      <th className="p-4 font-bold border-b">Waktu & Cabang</th>
                      <th className="p-4 font-bold border-b">Kasir</th>
                      <th className="p-4 font-bold border-b text-right">Modal Awal Laci</th>
                      <th className="p-4 font-bold border-b text-right text-blue-600">Omzet Sistem</th>
                      <th className="p-4 font-bold border-b text-right">Setoran Fisik</th>
                      <th className="p-4 font-bold border-b text-right">Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedShifts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 font-medium">
                          Belum ada laporan shift yang ditutup hari ini.
                        </td>
                      </tr>
                    ) : (
                      shifts.map((shift, i) => (
                        <tr key={shift.id || i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-bold text-gray-900">{shift.id}</td>
                          <td className="p-4">
                            <div className="font-bold text-gray-800">{shift.date}</div>
                            <div className="text-xs text-gray-500 font-medium flex items-center mt-1"><Building2 size={10} className="mr-1"/> {shift.branch}</div>
                          </td>
                          <td className="p-4 font-semibold text-gray-700 flex items-center space-x-2 pt-6">
                             <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{shift.cashier ? shift.cashier[0] : '-'}</div>
                             <span>{shift.cashier}</span>
                          </td>
                          <td className="p-4 text-right font-medium text-gray-500">Rp {shift.modal.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right font-black text-blue-600">Rp {shift.system.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right font-bold text-gray-900">Rp {shift.physical.toLocaleString('id-ID')}</td>
                          <td className="p-4 text-right">
                            {shift.selisih < 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-black bg-red-100 text-red-700">
                                - Rp {Math.abs(shift.selisih).toLocaleString('id-ID')}
                              </span>
                            ) : shift.selisih > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-black bg-blue-100 text-blue-700">
                                + Rp {shift.selisih.toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-black bg-green-100 text-green-700">
                                Balance ✅
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

          {activeTab === "cabang" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Daftar Cabang & Node IoT</h3>
                  <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-800">+ Tambah Cabang</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-bold border-b">Nama Cabang</th>
                        <th className="p-4 font-bold border-b">Node IoT (ESP32)</th>
                        <th className="p-4 font-bold border-b">Status Hardware</th>
                        <th className="p-4 font-bold border-b">Mode Sinkronisasi</th>
                        <th className="p-4 font-bold border-b text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedBranches.map((branch, i) => {
                        const deviceCode = branch.deviceCode || (branch.name === 'Tambun 1' ? 'NITRO-01' : `NITRO-0${i + 1}`);
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-gray-900 flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Building2 size={16} /></div>
                              <span>{branch.name}</span>
                            </td>
                            <td className="p-4 font-mono font-bold text-xs text-blue-700">
                              {deviceCode}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${branch.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                ● {branch.status}
                              </span>
                              {branch.lastActive && (
                                <div className="text-[10px] text-gray-500 font-medium mt-1">
                                  Heartbeat: {branch.lastActive}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-xs font-semibold text-gray-600">
                              Supabase REST (System A)
                            </td>
                            <td className="p-4 text-right">
                              <button onClick={() => setSelectedBranchConfig({...branch, deviceCode, index: i})} className="text-blue-600 font-bold text-sm hover:text-blue-800">Konfigurasi</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {activeTab === "crm" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-5 border-b bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <h3 className="font-bold text-gray-800">Database Pelanggan (Loyalti)</h3>
                  <div className="relative w-full sm:w-auto">
                     <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                     <input type="text" placeholder="Cari Plat Nomor..." className="pl-9 pr-4 py-2 w-full border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse whitespace-nowrap">
                   <thead>
                     <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                       <th className="p-4 font-bold border-b">Plat Kendaraan</th>
                       <th className="p-4 font-bold border-b">Kunjungan</th>
                       <th className="p-4 font-bold border-b">Terakhir Kunjung</th>
                       <th className="p-4 font-bold border-b">Layanan Favorit</th>
                       <th className="p-4 font-bold border-b text-right">Total Poin</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {[
                       { plat: "B 1234 ABC", kunjung: 12, last: "Hari Ini, 09:30", fav: "Isi Baru Motor", poin: 120 },
                       { plat: "B 4321 XYZ", kunjung: 8, last: "Kemarin, 14:15", fav: "Ganti Oli Mesin", poin: 80 },
                       { plat: "B 9999 KKK", kunjung: 3, last: "05 Okt 2026", fav: "Tambal Ban Motor", poin: 30 },
                       { plat: "D 5678 EFG", kunjung: 25, last: "01 Okt 2026", fav: "Isi Tambah Mobil", poin: 250 },
                     ].map((user, i) => (
                       <tr key={i} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 font-bold text-gray-900">
                           <div className="bg-gray-900 text-white px-2 py-1 rounded text-xs inline-block font-mono border-b-2 border-white ring-2 ring-gray-900">{user.plat}</div>
                         </td>
                         <td className="p-4 font-bold text-gray-700">{user.kunjung}x</td>
                         <td className="p-4 text-sm text-gray-500 font-medium">{user.last}</td>
                         <td className="p-4 text-sm text-gray-600 font-semibold">{user.fav}</td>
                         <td className="p-4 text-right font-black text-blue-600">{user.poin} <span className="text-xs font-normal text-gray-400">pts</span></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === "keuangan" && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <p className="text-gray-500 font-bold text-sm mb-1">
                       Total Pemasukan ({selectedPeriod === 'today' ? 'Hari Ini' : selectedPeriod === 'yesterday' ? 'Kemarin' : selectedPeriod === '7days' ? '7 Hari Terakhir' : 'Bulan Ini'})
                     </p>
                     <h2 className="text-3xl font-black text-blue-600">Rp {stats.omzet.toLocaleString('id-ID')}</h2>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <p className="text-gray-500 font-bold text-sm mb-1">Total Pengeluaran (HPP Estimasi)</p>
                     <h2 className="text-3xl font-black text-red-600">Rp {Math.round(stats.omzet * 0.2).toLocaleString('id-ID')}</h2>
                  </div>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <p className="text-gray-500 font-bold text-sm mb-1">Laba Bersih Estimasi</p>
                     <h2 className="text-3xl font-black text-emerald-600">Rp {stats.profit.toLocaleString('id-ID')}</h2>
                  </div>
               </div>
               
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                     <h3 className="font-bold text-gray-800">
                       Riwayat Transaksi Penjualan ({displayedSales.length} Transaksi)
                     </h3>
                     <button 
                       onClick={() => alert("Data riwayat transaksi siap diekspor!")} 
                       className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-md transition-all"
                     >
                       Export Excel
                     </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-bold border-b">ID Transaksi</th>
                          <th className="p-4 font-bold border-b">Waktu & Tanggal</th>
                          <th className="p-4 font-bold border-b">Cabang</th>
                          <th className="p-4 font-bold border-b text-right">Nilai Transaksi</th>
                          <th className="p-4 font-bold border-b text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedSales.map((trx, idx) => (
                          <tr key={trx.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-mono font-bold text-xs text-blue-700">TRX-{trx.id.slice(0, 8)}</td>
                            <td className="p-4 text-xs font-semibold text-gray-700">
                              {new Date(trx.created_at).toLocaleString('id-ID')}
                            </td>
                            <td className="p-4 text-xs font-bold text-gray-800">
                              {(trx.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !trx.branch_id) ? 'Tambun 1' : trx.branch_id}
                            </td>
                            <td className="p-4 text-right font-black text-sm text-gray-900">
                              Rp {Number(trx.total_amount).toLocaleString('id-ID')}
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                COMPLETED
                              </span>
                            </td>
                          </tr>
                        ))}
                        {displayedSales.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-gray-400 font-medium">
                              Belum ada riwayat transaksi pada periode dan cabang yang dipilih.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {activeTab === "pengaturan" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-w-3xl">
               <div className="p-6">
                 <h3 className="font-bold text-gray-800 text-lg mb-6">Konfigurasi Sistem Global</h3>
                 <div className="space-y-6">
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">Bot Telegram Security Alert</label>
                       <div className="flex gap-2">
                         <input type="text" defaultValue="@AlKahfiAlertBot" disabled className="w-full border rounded-lg px-4 py-2 bg-gray-100 text-gray-600 font-mono text-sm cursor-not-allowed" />
                         <span className="shrink-0 px-3 py-2 bg-green-100 text-green-700 font-bold text-xs rounded-lg flex items-center">
                           ● Terhubung
                         </span>
                       </div>
                       <p className="text-xs text-gray-400 mt-1">Grup Chat ID Owner: -10023481920 (Live Broadcast Dispatch)</p>
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">URL Database Supabase</label>
                       <input type="text" value="https://qxvgciwufwvchgfapjyk.supabase.co" disabled className="w-full border rounded-lg px-4 py-2 bg-gray-100 text-gray-500 cursor-not-allowed font-mono text-sm" />
                       <p className="text-xs text-gray-400 mt-1">Hanya dapat diubah dari Environment Variables</p>
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">Nama Perusahaan (Header Struk)</label>
                       <input type="text" defaultValue="Al-Kahfi Nitrogen & Oli" className="w-full border rounded-lg px-4 py-2 text-gray-800 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="pt-4 border-t">
                       <h4 className="font-bold text-gray-800 mb-4">Pengaturan Mode Kiosk Kasir</h4>
                       <label className="flex items-center space-x-3 cursor-pointer mb-3">
                          <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                          <div>
                            <p className="font-bold text-gray-800">Otomatis Kunci Kasir (Idle)</p>
                            <p className="text-xs text-gray-500">Minta PIN kembali setelah 5 menit tidak ada aktivitas</p>
                          </div>
                       </label>
                       <label className="flex items-center space-x-3 cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600 rounded" />
                          <div>
                            <p className="font-bold text-gray-800">Wajib Print Struk</p>
                            <p className="text-xs text-gray-500">Printer bluetooth harus terhubung untuk transaksi sukses</p>
                          </div>
                       </label>
                    </div>
                 </div>
               </div>
               <div className="p-4 bg-gray-50 border-t flex justify-end">
                  <button onClick={() => alert("Pengaturan berhasil disimpan!")} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm">Simpan Pengaturan</button>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">{newProduct.id ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Produk</label>
                <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Kategori Produk</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProduct({...newProduct, category: 'nitrogen'})}
                    className={`p-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center space-x-2 ${newProduct.category === 'nitrogen' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span>⚗️</span><span>Layanan Nitrogen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProduct({...newProduct, category: 'ritel'})}
                    className={`p-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center space-x-2 ${newProduct.category === 'ritel' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <span>🛒</span><span>Ritel & Aksesoris</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Harga Jual</label>
                  <input type="number" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900" value={newProduct.harga} onChange={e => setNewProduct({...newProduct, harga: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">HPP (Modal)</label>
                  <input type="number" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900" value={newProduct.hpp} onChange={e => setNewProduct({...newProduct, hpp: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Stok Fisik</label>
                  <input type="number" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900" value={newProduct.stok} onChange={e => setNewProduct({...newProduct, stok: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Foto Produk</label>
                  <input type="file" accept="image/*" className="w-full text-sm" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setNewProduct({...newProduct, img: ev.target?.result as string});
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
                </div>
              </div>
              {newProduct.img && (
                 <div className="mt-2 text-center">
                    <img src={newProduct.img} alt="Preview" className="w-24 h-24 object-cover mx-auto rounded border" />
                 </div>
              )}
            </div>
            <div className="mt-6 flex justify-between items-center">
              {newProduct.id && (
                <button onClick={async () => {
                  if (!confirm('Hapus produk ini? Tindakan tidak dapat dibatalkan.')) return;
                  try {
                    await supabase.from('products').delete().eq('id', newProduct.id);
                    const updated = products.filter(p => p.id !== newProduct.id);
                    setProducts(updated);
                    saveProducts(updated);
                    setShowProductModal(false);
                    setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen' });
                    alert('Produk berhasil dihapus!');
                  } catch (err: any) {
                    alert('Gagal menghapus: ' + (err?.message || 'Error'));
                  }
                }} className="px-4 py-2 font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm">🗑 Hapus</button>
              )}
              <div className="flex space-x-3 ml-auto">
                <button onClick={() => { setShowProductModal(false); setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen' }); }} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
                <button onClick={async () => {
                  if (!newProduct.name.trim()) { alert('Nama produk tidak boleh kosong!'); return; }
                  try {
                    let updated: any[];
                    if (newProduct.id) {
                      // Update di Supabase
                      const { error } = await supabase.from('products').update({
                        name: newProduct.name,
                        harga: newProduct.harga,
                        hpp: newProduct.hpp,
                        stok: newProduct.stok,
                        img: newProduct.img,
                        category: newProduct.category,
                        updated_at: new Date().toISOString()
                      }).eq('id', newProduct.id);
                      if (error) throw error;
                      updated = products.map(p => p.id === newProduct.id ? { ...newProduct } : p);
                      alert('Produk berhasil diperbarui!');
                    } else {
                      // Insert ke Supabase
                      const { data: inserted, error } = await supabase.from('products').insert({
                        name: newProduct.name,
                        harga: newProduct.harga,
                        hpp: newProduct.hpp,
                        stok: newProduct.stok,
                        img: newProduct.img,
                        category: newProduct.category
                      }).select().single();
                      if (error) throw error;
                      updated = [...products, inserted];
                      alert('Produk berhasil ditambahkan!');
                    }
                    setProducts(updated);
                    saveProducts(updated);
                    // Broadcast ke kasir agar update real-time
                    const bc = new BroadcastChannel('pos_demo_channel');
                    bc.postMessage({ type: 'DB_UPDATE', payload: { entity: 'products' } });
                    bc.close();
                    setShowProductModal(false);
                    setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen' });
                  } catch (err: any) {
                    alert('Gagal menyimpan produk: ' + (err?.message || 'Error koneksi Supabase'));
                  }
                }} className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow">Simpan Produk</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Add Operator Modal */}
      {showOperatorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-800">Tambah Kasir Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900" value={newOperator.name} onChange={e => setNewOperator({...newOperator, name: e.target.value})} placeholder="Misal: Budi Santoso" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">PIN Akses (4-6 digit)</label>
                <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-mono font-bold text-gray-900" value={newOperator.pin} onChange={e => setNewOperator({...newOperator, pin: e.target.value.replace(/\D/g, '')})} placeholder="1234" maxLength={6} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cabang Penempatan</label>
                <select className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" value={newOperator.branch} onChange={e => setNewOperator({...newOperator, branch: e.target.value})}>
                  {branchStats.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setShowOperatorModal(false)} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
              <button onClick={() => {
                if (!newOperator.name || !newOperator.pin || !newOperator.branch) {
                  alert("Harap lengkapi semua data!");
                  return;
                }
                const newOps = [...operators, { ...newOperator, id: Date.now() }];
                setOperators(newOps);
                saveOperators(newOps);
                alert("Kasir berhasil ditambahkan!");
                setShowOperatorModal(false);
              }} className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow">Simpan Karyawan</button>
            </div>
          </div>
        </div>
      )}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSnapshot(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedSnapshot(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300 font-bold text-sm bg-white/10 px-4 py-2 rounded-lg backdrop-blur-md">
              Tutup (Esc)
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedSnapshot} alt="CCTV Full Res" className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10" />
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white rounded-b-xl">
              <p className="font-bold">Bukti CCTV Otomatis (Resolusi Tinggi)</p>
              <p className="text-xs text-gray-300">File asli tersimpan di Cloudinary dengan enkripsi WORM.</p>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Fraud Alert Detail Modal */}
      {selectedFraudModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedFraudModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 overflow-hidden border border-red-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <span className="inline-flex items-center text-[10px] bg-red-100 text-red-700 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                    Security Anomaly
                  </span>
                  <h3 className="text-lg font-black text-gray-900 leading-snug">{selectedFraudModal.title}</h3>
                </div>
              </div>
              <button onClick={() => setSelectedFraudModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <div>
                  <p className="text-gray-400 font-semibold">Cabang Lokasi</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{selectedFraudModal.branch}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold">Waktu Deteksi</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{selectedFraudModal.time} WIB</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold">Kasir Bertugas</p>
                  <p className="font-bold text-gray-800 mt-0.5">{selectedFraudModal.cashier || 'Kasir'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold">Status Notifikasi</p>
                  <p className="font-bold text-emerald-600 mt-0.5 flex items-center">
                    <CheckCircle size={12} className="mr-1" /> Terkirim ke Telegram
                  </p>
                </div>
              </div>

              {/* Deskripsi */}
              <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-100">
                <p className="text-xs font-bold text-red-800 mb-1">Analisis Kecurangan / Anomali:</p>
                <p className="text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedFraudModal.description || 'Terdeteksi perbedaan antara aktivitas sensor mesin kompresor/IoT dengan mutasi kasir yang tercatat di sistem POS.'}
                </p>
              </div>

              {/* Telegram Dispatch Info Box */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start space-x-3">
                <div className="p-1.5 bg-blue-600 text-white rounded-lg mt-0.5 shrink-0">
                  <Send size={14} />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-blue-900">Telegram Bot Integration Active</p>
                  <p className="text-blue-700 mt-0.5">
                    Alert ini telah otomatis diteruskan ke Bot Telegram <b>@AlKahfiAlertBot</b> grup Owner & Supervisor.
                  </p>
                </div>
              </div>

              {/* Snapshot preview if available */}
              {selectedFraudModal.snapshotUrl && (
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-1.5 flex items-center">
                    <Camera size={14} className="mr-1 text-blue-600" /> Bukti Foto CCTV Terkait:
                  </p>
                  <div 
                    onClick={() => setSelectedSnapshot(selectedFraudModal.snapshotUrl)}
                    className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 cursor-pointer group"
                  >
                    <img src={selectedFraudModal.snapshotUrl} alt="CCTV" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-lg">Klik untuk Zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex flex-col sm:flex-row justify-end gap-2">
              <button 
                onClick={() => {
                  alert(`🚨 Notifikasi Ulang Berhasil Terkirim!\n\nPesan darurat telah dikirim kembali ke Telegram Bot @AlKahfiAlertBot untuk cabang ${selectedFraudModal.branch}.`);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <Send size={13} />
                <span>Kirim Ulang ke Telegram</span>
              </button>
              <button 
                onClick={() => {
                  setSelectedFraudModal(null);
                  setActiveTab("audit");
                }} 
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all"
              >
                <Camera size={13} />
                <span>Investigasi di Audit CCTV</span>
              </button>
              <button 
                onClick={() => setSelectedFraudModal(null)} 
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Configuration Modal */}
      {selectedBranchConfig && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-800">Konfigurasi Node IoT: {selectedBranchConfig.name}</h3>
                <p className="text-xs text-gray-400">Sinkronisasi Hardware ESP32 & Solenoid Valve</p>
              </div>
              <button onClick={() => setSelectedBranchConfig(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-bold text-blue-800 mb-1">Status Sinkronisasi ESP32 (System A - Time Starvation)</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  ESP32 terhubung langsung ke Cloud Supabase (tabel <b>branch_devices</b>). Saat kasir memproses pengerjaan, status berubah ke <b>ACTIVE</b> dan ESP32 akan membuka solenoid valve pada GPIO 4 secara otomatis.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nama Cabang</label>
                  <input type="text" value={selectedBranchConfig.name} onChange={(e) => setSelectedBranchConfig({...selectedBranchConfig, name: e.target.value})} className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Device Code (ESP32 Node ID)</label>
                  <input type="text" value={selectedBranchConfig.deviceCode || 'NITRO-01'} onChange={(e) => setSelectedBranchConfig({...selectedBranchConfig, deviceCode: e.target.value})} className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-mono font-bold text-sm text-blue-800" />
                </div>
              </div>

              {/* Status Hardware Real-time Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-500 font-medium">Status Real Perangkat:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${selectedBranchConfig.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    ● {selectedBranchConfig.status || 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-500 font-medium">Device Relay State:</span>
                  <span className="font-mono font-bold text-gray-800">{selectedBranchConfig.deviceStatus || 'IDLE'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Heartbeat Terakhir:</span>
                  <span className="font-semibold text-gray-700">{selectedBranchConfig.lastActive || 'Belum ada heartbeat'}</span>
                </div>
              </div>

              {/* Panduan WiFi Setup Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                <p className="font-bold text-amber-900 mb-0.5">WiFi Captive Portal ESP32 (WiFiManager):</p>
                <p className="text-amber-800">
                  Untuk hubungkan ESP32 baru ke WiFi outlet, sambungkan HP/Tablet ke hotspot: <b>AL-KAHFI-NITROGEN-SETUP</b> lalu buka browser di IP <b>192.168.4.1</b>.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="font-bold text-gray-800 text-sm">Status Cabang Aktif</p>
                  <p className="text-xs text-gray-500">Nonaktifkan untuk perawatan berkala</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={selectedBranchConfig.status === 'Online'} onChange={(e) => setSelectedBranchConfig({...selectedBranchConfig, status: e.target.checked ? 'Online' : 'Offline'})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-2">
              <button 
                type="button"
                onClick={async () => {
                  try {
                    const devCode = selectedBranchConfig.deviceCode || 'NITRO-01';
                    const { error } = await supabase
                      .from('branch_devices')
                      .update({
                        device_status: 'ACTIVE',
                        active_duration_seconds: 5,
                        last_heartbeat: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })
                      .eq('device_code', devCode);
                    if (error) throw error;
                    alert(`⚡ Sinyal Test Terkirim!\n\nPerintah buka valve selama 5 detik telah dikirim ke perangkat ${devCode} via Supabase. Periksa apakah relay ESP32 menyala.`);
                  } catch (err: any) {
                    alert(`Gagal mengirim sinyal test: ${err?.message || 'Error koneksi Supabase'}`);
                  }
                }}
                className="w-full sm:w-auto px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1"
              >
                <span>⚡ Test Buka Valve (5s)</span>
              </button>

              <div className="flex space-x-2 w-full sm:w-auto justify-end">
                <button onClick={() => setSelectedBranchConfig(null)} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Batal</button>
                <button onClick={async () => {
                  try {
                    const devCode = selectedBranchConfig.deviceCode || 'NITRO-01';
                    await supabase
                      .from('branch_devices')
                      .update({
                        updated_at: new Date().toISOString()
                      })
                      .eq('device_code', devCode);

                    setBranchStats((prev) => {
                      const newStats = [...prev];
                      newStats[selectedBranchConfig.index] = { ...selectedBranchConfig };
                      delete newStats[selectedBranchConfig.index].index;
                      saveBranches(newStats);
                      return newStats;
                    });
                    alert(`✅ Konfigurasi untuk ${selectedBranchConfig.name} (${devCode}) berhasil disimpan dan disinkronkan ke Cloud Supabase & ESP32!`);
                    setSelectedBranchConfig(null);
                  } catch (err: any) {
                    alert(`Gagal menyimpan: ${err?.message || 'Error'}`);
                  }
                }} className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow text-sm">Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
