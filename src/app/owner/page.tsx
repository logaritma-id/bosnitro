"use client";

import { useState, useEffect, useMemo } from "react";
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
  Send,
  Trash2,
  Download,
  Gift,
  Phone,
  MessageSquare,
  Save,
  RotateCcw,
  Printer,
  ScanLine,
  Award,
  Target,
  Percent,
  TrendingDown,
  Sparkles,
  HelpCircle,
  Edit3
} from "lucide-react";
import { 
  getProducts, 
  saveProducts, 
  getOperators, 
  saveOperators, 
  getBranches, 
  saveBranches, 
  getCustomers, 
  saveCustomers,
  getKpiSettings,
  saveKpiSettings,
  DEFAULT_KPI_SETTINGS,
  KPISettings 
} from "../../lib/localDb";
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

// Konfigurasi Default Sistem Global
const DEFAULT_SYSTEM_SETTINGS = {
  telegramBotUsername: "@AlKahfiAlertBot",
  telegramChatId: "-10023481920",
  telegramBotToken: "",
  telegramAlertEnabled: true,
  supabaseUrl: "https://qxvgciwufwvchgfapjyk.supabase.co",
  companyName: "Al-Kahfi Nitrogen & Oli",
  companyAddress: "Jl. Raya Tambun - Cibitung No. 88, Bekasi",
  companyPhone: "0812-9876-5432",
  receiptFooter: "Terima Kasih Atas Kunjungan Anda! Garansi Pengisian 24 Jam.",
  autoLockIdle: true,
  idleTimeoutMinutes: 5,
  requireReceiptPrint: true,
  requireFaceAttendance: true,
  iotHeartbeatAlert: true
};

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
  const [newProduct, setNewProduct] = useState<{id?: number, name: string, harga: number, hpp: number, stok: number, img: string, category: string, barcode?: string}>({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen', barcode: '' });
  const [ownerScannerActive, setOwnerScannerActive] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [scannedProductResult, setScannedProductResult] = useState<any | null>(null);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [newOperator, setNewOperator] = useState<{id?: number, name: string, pin: string, branch: string, role?: string, baseCommissionRate?: number}>({ name: '', pin: '', branch: '', role: 'Operator', baseCommissionRate: 5 });
  const [kpiSettings, setKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const [showKpiSettingsModal, setShowKpiSettingsModal] = useState(false);
  const [editingKpiSettings, setEditingKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const [showKpiSimulation, setShowKpiSimulation] = useState(false);
  const [simulationDailyAvg, setSimulationDailyAvg] = useState(300000);
  const [kpiBranchFilter, setKpiBranchFilter] = useState("Semua Cabang");
  const [kpiRoleFilter, setKpiRoleFilter] = useState<"ALL" | "Operator" | "Supervisor">("ALL");
  const [currentDayOfMonth, setCurrentDayOfMonth] = useState(1);
  const [selectedBranchConfig, setSelectedBranchConfig] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [crmSearch, setCrmSearch] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<{id?: number, plat: string, phone: string, fav: string, poin: number, kunjung: number, branch: string}>({ plat: '', phone: '', fav: 'Isi Baru Motor', poin: 10, kunjung: 1, branch: 'Tambun 1' });
  const [showRedeemModal, setShowRedeemModal] = useState<any | null>(null);
  const [financeSearch, setFinanceSearch] = useState("");
  const [financePaymentFilter, setFinancePaymentFilter] = useState<"ALL" | "CASH" | "QRIS">("ALL");
  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);
  const [testingDbStatus, setTestingDbStatus] = useState<string | null>(null);
  const [testingTelegramStatus, setTestingTelegramStatus] = useState<string | null>(null);


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
          id: `TRX-${String(t.id).slice(0, 6)}`,
          rawId: t.id,
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
          id: `ABS-${String(t.id).slice(0, 6)}`,
          rawId: t.id,
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
    setCurrentDayOfMonth(Math.max(1, new Date().getDate()));
    setProducts(getProducts());
    setOperators(getOperators());
    setBranchStats(getBranches());
    setKpiSettings(getKpiSettings());
    
    // Load System Settings dari localStorage jika ada
    try {
      const savedSettings = localStorage.getItem("pos_system_settings");
      if (savedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      }
    } catch (e) {
      console.warn("Gagal membaca pos_system_settings:", e);
    }

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
        if (event.data.payload.entity === 'customers') setCustomers(getCustomers());
        if (event.data.payload.entity === 'kpiSettings') setKpiSettings(getKpiSettings());
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

  const qrisSales = displayedSales.filter(t => (t.payment_method || '').toUpperCase().includes('QRIS'));
  const totalQris = qrisSales.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
  const cashSales = displayedSales.filter(t => !(t.payment_method || '').toUpperCase().includes('QRIS'));
  const totalCash = cashSales.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
  const avgTrxAmount = displayedSales.length > 0 ? Math.round(stats.omzet / displayedSales.length) : 0;

  const filteredFinanceSales = displayedSales.filter(trx => {
    if (financePaymentFilter === "CASH" && (trx.payment_method || '').toUpperCase().includes('QRIS')) return false;
    if (financePaymentFilter === "QRIS" && !(trx.payment_method || '').toUpperCase().includes('QRIS')) return false;
    if (!financeSearch.trim()) return true;
    const q = financeSearch.toLowerCase().trim();
    const idStr = String(trx.id || '').toLowerCase();
    const branchStr = ((trx.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !trx.branch_id) ? 'tambun 1' : String(trx.branch_id)).toLowerCase();
    const methodStr = (trx.payment_method || 'cash').toLowerCase();
    const amountStr = String(trx.total_amount || '');
    return idStr.includes(q) || branchStr.includes(q) || methodStr.includes(q) || amountStr.includes(q);
  });

  // --- KALKULASI EVALUASI KINERJA & SKEMA KOMISI KARYAWAN (KPI OTOMATIS) ---
  const kpiEvaluations = useMemo(() => {
    // Tentukan hari pembagi rata-rata berdasarkan periode dashboard
    const periodDays = selectedPeriod === 'today' ? 1 
      : selectedPeriod === 'yesterday' ? 1 
      : selectedPeriod === '7days' ? 7 
      : currentDayOfMonth;

    // Transaksi completed pada periode yang dipilih
    const completedTrx = rawTransactions.filter(t => isWithinPeriod(t.created_at, selectedPeriod) && t.payment_status === 'COMPLETED');

    // Ringkasan KPI per Cabang
    const branchSummaries = branchStats.map(branch => {
      const customConfig = kpiSettings.branchTargets?.[branch.name];
      const monthlyTarget = customConfig?.monthlyTarget || kpiSettings.monthlyTarget; // Default 15.000.000
      const dailyTarget = customConfig?.dailyTarget || kpiSettings.dailyTarget; // Default 500.000 (15jt / 30 hari)
      const thresholdDaily = customConfig?.thresholdDaily || kpiSettings.thresholdDaily; // Benchmark 250.000

      // Penjualan cabang ini
      const bSales = completedTrx.filter(t => {
        const bName = (t.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !t.branch_id) ? 'Tambun 1' : t.branch_id;
        return bName.toLowerCase() === branch.name.toLowerCase();
      });

      const totalOmzet = bSales.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
      const totalTrxCount = bSales.length;

      // Realisasi rata-rata omset per hari
      const dailyAvg = periodDays > 0 ? Math.round(totalOmzet / periodDays) : 0;

      // Status KPI sesuai aturan user:
      // - Rata-rata >= 250rb/hari -> Memenuhi Standar (+25% Komisi: +15% Operator & +10% SPV)
      // - Rata-rata < 250rb/hari -> Di Bawah Standar (-25% Potongan: -15% Operator & -10% SPV)
      const isTargetMet = dailyAvg >= thresholdDaily;
      const targetAchievementPct = dailyTarget > 0 ? Math.min(200, Math.round((dailyAvg / dailyTarget) * 100)) : 0;

      return {
        branchName: branch.name,
        status: branch.status,
        totalOmzet,
        totalTrxCount,
        periodDays,
        dailyAvg,
        monthlyTarget,
        dailyTarget,
        thresholdDaily,
        isTargetMet,
        targetAchievementPct,
        operatorAdjustmentRate: kpiSettings.operatorAdjustmentRate, // 15%
        supervisorAdjustmentRate: kpiSettings.supervisorAdjustmentRate, // 10%
      };
    });

    // Evaluasi Komisi per Karyawan (Operator Kasir & Supervisor SPV)
    const employeeEvaluations = operators.map(op => {
      const role: "Operator" | "Supervisor" = op.role === 'Supervisor' || (op.name && (op.name.toLowerCase().includes('spv') || op.name.toLowerCase().includes('supervisor')))
        ? 'Supervisor'
        : 'Operator';

      const branchSummary = branchSummaries.find(b => b.branchName.toLowerCase() === (op.branch || '').toLowerCase()) || {
        branchName: op.branch || '-',
        status: 'Online',
        totalOmzet: 0,
        totalTrxCount: 0,
        dailyAvg: 0,
        dailyTarget: kpiSettings.dailyTarget,
        monthlyTarget: kpiSettings.monthlyTarget,
        thresholdDaily: kpiSettings.thresholdDaily,
        isTargetMet: false,
        periodDays,
        targetAchievementPct: 0,
        operatorAdjustmentRate: kpiSettings.operatorAdjustmentRate,
        supervisorAdjustmentRate: kpiSettings.supervisorAdjustmentRate,
      };

      // Komisi Dasar Rate (%)
      const baseRate = op.baseCommissionRate !== undefined 
        ? Number(op.baseCommissionRate) 
        : (role === 'Supervisor' ? kpiSettings.supervisorBaseRate : kpiSettings.operatorBaseRate);

      // Nilai Komisi Dasar dari omset cabang
      const baseCommission = Math.round(branchSummary.totalOmzet * (baseRate / 100));

      // Persentase Penyesuaian Komisi:
      // Operator: 15%
      // Supervisor: 10%
      // Total penyesuaian: 25% (15% + 10%)
      const adjRate = role === 'Supervisor' ? kpiSettings.supervisorAdjustmentRate : kpiSettings.operatorAdjustmentRate;

      // Evaluasi:
      // Jika branchSummary.isTargetMet (rata2 >= 250rb) -> TAMBAHAN / BONUS (+), jika tidak -> POTONGAN (-)
      const isBonus = branchSummary.isTargetMet;
      const adjustmentAmount = Math.round(baseCommission * (adjRate / 100));
      const netCommission = isBonus 
        ? baseCommission + adjustmentAmount 
        : Math.max(0, baseCommission - adjustmentAmount);

      return {
        id: op.id,
        name: op.name,
        pin: op.pin,
        branch: op.branch,
        role,
        baseRate,
        baseCommission,
        branchOmzet: branchSummary.totalOmzet,
        branchDailyAvg: branchSummary.dailyAvg,
        dailyTarget: branchSummary.dailyTarget,
        monthlyTarget: branchSummary.monthlyTarget,
        thresholdDaily: branchSummary.thresholdDaily,
        isTargetMet: branchSummary.isTargetMet,
        isBonus,
        adjRate,
        adjustmentAmount,
        netCommission,
      };
    });

    return {
      periodDays,
      branchSummaries,
      employeeEvaluations,
    };
  }, [rawTransactions, branchStats, operators, selectedPeriod, kpiSettings, currentDayOfMonth]);

  // Handler Export Laporan Evaluasi KPI & Komisi ke CSV / Excel
  const handleExportKpiExcel = () => {
    const headers = [
      "ID Karyawan",
      "Nama Karyawan",
      "Jabatan",
      "Cabang",
      "Omzet Cabang Periode (Rp)",
      "Rata-rata Omzet Harian (Rp)",
      "Target Harian (Rp)",
      "Ambang Batas KPI (Rp)",
      "Status Evaluasi",
      "Komisi Dasar Rate (%)",
      "Komisi Dasar (Rp)",
      "Skema Penyesuaian Rate (%)",
      "Nilai Penyesuaian (Rp)",
      "Total Komisi Bersih Diterima (Rp)"
    ];

    const rows = kpiEvaluations.employeeEvaluations.map(emp => [
      emp.id,
      `"${emp.name.replace(/"/g, '""')}"`,
      emp.role,
      `"${emp.branch}"`,
      emp.branchOmzet,
      emp.branchDailyAvg,
      emp.dailyTarget,
      emp.thresholdDaily,
      emp.isBonus ? "Target Tercapai (+25% Skema Bonus)" : "Di Bawah Standar (-25% Skema Potongan)",
      `${emp.baseRate}%`,
      emp.baseCommission,
      emp.isBonus ? `+${emp.adjRate}%` : `-${emp.adjRate}%`,
      emp.isBonus ? emp.adjustmentAmount : -emp.adjustmentAmount,
      emp.netCommission
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_KPI_Komisi_Karyawan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // Handler untuk menghapus satu catatan absensi
  const handleDeleteAttendance = async (att: any) => {
    if (!confirm(`Hapus rekaman absensi ${att.cashier} (${att.time} di ${att.branch})?\nTindakan ini akan menghapus data foto dan status absensi.`)) return;
    try {
      const targetId = att.rawId || att.id;
      if (targetId && !String(targetId).startsWith('att-')) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', targetId);
        if (error) console.warn("Supabase delete warning:", error);
      }
      setRawTransactions(prev => prev.filter(t => t.id !== targetId && t.id !== att.rawId));
      setAttendances(prev => prev.filter(a => (a.rawId || a.id) !== targetId));
      alert("✅ Catatan absensi berhasil dihapus!");
    } catch (err: any) {
      alert("Gagal menghapus absensi: " + (err?.message || "Error"));
    }
  };

  // Handler untuk membersihkan semua riwayat absensi periode/cabang saat ini
  const handleClearAllAttendances = async () => {
    if (displayedAttendances.length === 0) {
      alert("Tidak ada catatan absensi yang dapat dihapus.");
      return;
    }
    const msg = selectedBranch === "Semua Cabang"
      ? `Hapus SEMUA (${displayedAttendances.length}) riwayat absensi pada periode ini?`
      : `Hapus semua (${displayedAttendances.length}) riwayat absensi untuk cabang ${selectedBranch}?`;
    if (!confirm(msg + "\nTindakan ini tidak dapat dibatalkan.")) return;

    try {
      const idsToDelete = displayedAttendances.map(a => a.rawId || a.id);
      for (const id of idsToDelete) {
        if (!String(id).startsWith('att-')) {
          await supabase.from('transactions').delete().eq('id', id);
        }
      }
      setRawTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
      setAttendances(prev => prev.filter(a => !idsToDelete.includes(a.rawId || a.id)));
      alert("✅ Seluruh riwayat absensi berhasil dibersihkan!");
    } catch (err: any) {
      alert("Gagal membersihkan absensi: " + (err?.message || "Error"));
    }
  };

  // Handler export shift ke format CSV / Excel
  const handleExportShiftExcel = () => {
    if (displayedShifts.length === 0) {
      alert("Tidak ada data shift untuk diekspor pada periode ini.");
      return;
    }
    const headers = ["ID Shift", "Waktu", "Cabang", "Kasir", "Modal Awal", "Omzet Sistem", "Setoran Fisik", "Selisih"];
    const rows = displayedShifts.map((s: any) => [
      s.id,
      `"${s.date}"`,
      `"${s.branch}"`,
      `"${s.cashier}"`,
      s.modal,
      s.system,
      s.physical,
      s.selisih
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Shift_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // Filter pelanggan CRM
  const displayedCustomers = customers.filter((c: any) => {
    const branchMatch = selectedBranch === "Semua Cabang" || (c.branch || "Tambun 1").toLowerCase() === selectedBranch.toLowerCase();
    const searchMatch = !crmSearch || 
      (c.plat && c.plat.toLowerCase().includes(crmSearch.toLowerCase())) ||
      (c.phone && c.phone.includes(crmSearch)) ||
      (c.fav && c.fav.toLowerCase().includes(crmSearch.toLowerCase()));
    return branchMatch && searchMatch;
  });

  // Handler simpan pelanggan (Tambah / Edit)
  const handleSaveCustomer = async () => {
    if (!newCustomer.plat.trim()) {
      alert("Plat kendaraan tidak boleh kosong!");
      return;
    }
    const platClean = newCustomer.plat.trim().toUpperCase();
    try {
      let updated: any[];
      if (newCustomer.id) {
        // Update
        const { error } = await supabase.from('customers').update({
          plat: platClean,
          phone: newCustomer.phone,
          fav: newCustomer.fav,
          poin: newCustomer.poin,
          kunjung: newCustomer.kunjung,
          branch: newCustomer.branch,
          updated_at: new Date().toISOString()
        }).eq('id', newCustomer.id);
        if (error) console.warn("Supabase update customer warning:", error);
        updated = customers.map(c => c.id === newCustomer.id ? { ...newCustomer, plat: platClean } : c);
        alert("✅ Data pelanggan berhasil diperbarui!");
      } else {
        // Insert
        const { data: inserted, error } = await supabase.from('customers').insert({
          plat: platClean,
          phone: newCustomer.phone,
          fav: newCustomer.fav,
          poin: newCustomer.poin,
          kunjung: newCustomer.kunjung,
          branch: newCustomer.branch,
          last: 'Hari Ini, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }).select().single();
        if (error) console.warn("Supabase insert customer warning:", error);
        const itemToAdd = inserted || {
          ...newCustomer,
          plat: platClean,
          id: Date.now(),
          last: 'Hari Ini, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
        updated = [itemToAdd, ...customers];
        alert("✅ Pelanggan baru berhasil ditambahkan!");
      }
      setCustomers(updated);
      saveCustomers(updated);
      setShowCustomerModal(false);
      setNewCustomer({ plat: '', phone: '', fav: 'Isi Baru Motor', poin: 10, kunjung: 1, branch: selectedBranch === 'Semua Cabang' ? 'Tambun 1' : selectedBranch });
    } catch (err: any) {
      alert("Gagal menyimpan data pelanggan: " + (err?.message || "Error"));
    }
  };

  // Handler hapus pelanggan
  const handleDeleteCustomer = async (cust: any) => {
    if (!confirm(`Hapus data pelanggan ${cust.plat}?\nRiwayat kunjungan & poin akan dihapus permanen.`)) return;
    try {
      if (cust.id) {
        await supabase.from('customers').delete().eq('id', cust.id);
      }
      const updated = customers.filter(c => c.id !== cust.id && c.plat !== cust.plat);
      setCustomers(updated);
      saveCustomers(updated);
      alert("✅ Data pelanggan berhasil dihapus!");
    } catch (err: any) {
      alert("Gagal menghapus pelanggan: " + (err?.message || "Error"));
    }
  };

  // Handler klaim reward tukar poin
  const handleRedeemReward = async (cust: any, cost: number, rewardName: string) => {
    if (cust.poin < cost) {
      alert(`Poin tidak cukup! Pelanggan memiliki ${cust.poin} pts, dibutuhkan ${cost} pts.`);
      return;
    }
    if (!confirm(`Klaim reward "${rewardName}" untuk ${cust.plat}?\nPoin akan dipotong sebanyak ${cost} pts.`)) return;

    try {
      const remainingPoints = cust.poin - cost;
      if (cust.id) {
        await supabase.from('customers').update({ poin: remainingPoints }).eq('id', cust.id);
      }
      const updated = customers.map(c => (c.id === cust.id || c.plat === cust.plat) ? { ...c, poin: remainingPoints } : c);
      setCustomers(updated);
      saveCustomers(updated);
      setShowRedeemModal(null);
      alert(`🎉 Reward "${rewardName}" berhasil diklaim untuk ${cust.plat}!\nSisa poin pelanggan: ${remainingPoints} pts.`);
    } catch (err: any) {
      alert("Gagal memproses klaim reward: " + (err?.message || "Error"));
    }
  };

  // Handler ekspor data CRM ke CSV
  const handleExportCrmExcel = () => {
    if (displayedCustomers.length === 0) {
      alert("Tidak ada data pelanggan untuk diekspor.");
      return;
    }
    const headers = ["Plat Kendaraan", "Nomor WhatsApp", "Total Kunjungan", "Terakhir Kunjung", "Layanan Favorit", "Poin Loyalti", "Cabang"];
    const rows = displayedCustomers.map((c: any) => [
      `"${c.plat}"`,
      `"${c.phone || '-'}"`,
      `"${c.kunjung || 1}x"`,
      `"${c.last || '-'}"`,
      `"${c.fav || '-'}"`,
      c.poin || 0,
      `"${c.branch || '-'}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CRM_Pelanggan_${selectedBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler ekspor riwayat transaksi & laporan keuangan ke CSV / Excel
  const handleExportFinanceExcel = () => {
    if (displayedSales.length === 0) {
      alert("Tidak ada data transaksi keuangan untuk diekspor pada periode ini.");
      return;
    }
    const headers = ["No", "ID Transaksi", "Waktu & Tanggal", "Cabang", "Metode Pembayaran", "Nilai Transaksi (Rp)", "Status"];
    const rows = displayedSales.map((trx: any, idx: number) => {
      const trxId = `TRX-${String(trx.id || '').slice(0, 8)}`;
      const trxTime = new Date(trx.created_at).toLocaleString('id-ID');
      const branchName = (trx.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !trx.branch_id) ? 'Tambun 1' : trx.branch_id;
      const paymentMethod = (trx.payment_method || '').toUpperCase().includes('QRIS') ? 'QRIS' : 'CASH (Tunai)';
      const amount = Number(trx.total_amount || 0);
      const status = trx.payment_status || 'COMPLETED';
      return [
        idx + 1,
        `"${trxId}"`,
        `"${trxTime}"`,
        `"${branchName}"`,
        `"${paymentMethod}"`,
        amount,
        `"${status}"`
      ];
    });

    const allRows = [
      headers,
      ...rows,
      ["", "", "", "", "", "", ""],
      ["", "", "", "RINGKASAN LAPORAN KEUANGAN", "", "", ""],
      ["", "", "", "Total Pemasukan (Omzet)", "", stats.omzet, ""],
      ["", "", "", "Total Tunai (Cash)", "", totalCash, ""],
      ["", "", "", "Total QRIS", "", totalQris, ""],
      ["", "", "", "Total Pengeluaran (Estimasi HPP 20%)", "", Math.round(stats.omzet * 0.2), ""],
      ["", "", "", "Estimasi Laba Bersih (80%)", "", stats.profit, ""]
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + allRows.map((e: any) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Keuangan_${selectedBranch.replace(/\s+/g, '_')}_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handler untuk menghapus / void transaksi penjualan
  const handleDeleteTransaction = async (trx: any) => {
    const trxDisplayId = `TRX-${String(trx.id || '').slice(0, 8)}`;
    const trxAmount = Number(trx.total_amount || 0).toLocaleString('id-ID');
    if (!confirm(`Hapus / Void transaksi ${trxDisplayId} senilai Rp ${trxAmount}?\nData omzet dan laporan keuangan akan langsung diperbarui otomatis.`)) return;

    try {
      const targetId = trx.id;
      if (targetId && !String(targetId).startsWith('trx-')) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', targetId);
        if (error) console.warn("Supabase delete transaction warning:", error);
      }
      setRawTransactions(prev => prev.filter(t => t.id !== targetId));
      alert(`✅ Transaksi ${trxDisplayId} berhasil dihapus.`);
    } catch (err: any) {
      alert("Gagal menghapus transaksi: " + (err?.message || "Error"));
    }
  };

  // Handler simpan pengaturan sistem ke LocalStorage & broadcast real-time
  const handleSaveSettings = () => {
    try {
      localStorage.setItem("pos_system_settings", JSON.stringify(settings));
      if (typeof window !== "undefined") {
        const channel = new BroadcastChannel('pos_demo_channel');
        channel.postMessage({ type: 'SETTINGS_UPDATE', payload: settings });
        channel.close();
      }
      setSettingsSavedSuccess(true);
      setTimeout(() => setSettingsSavedSuccess(false), 4000);
      alert("✅ Pengaturan sistem berhasil disimpan dan diterapkan!");
    } catch (err: any) {
      alert("Gagal menyimpan pengaturan: " + (err?.message || "Error"));
    }
  };

  // Handler kembalikan ke default konfigurasi pabrik
  const handleResetSettings = () => {
    if (!confirm("Kembalikan seluruh konfigurasi sistem ke setelan default pabrik?")) return;
    setSettings(DEFAULT_SYSTEM_SETTINGS);
    try {
      localStorage.setItem("pos_system_settings", JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
      if (typeof window !== "undefined") {
        const channel = new BroadcastChannel('pos_demo_channel');
        channel.postMessage({ type: 'SETTINGS_UPDATE', payload: DEFAULT_SYSTEM_SETTINGS });
        channel.close();
      }
      setSettingsSavedSuccess(true);
      setTimeout(() => setSettingsSavedSuccess(false), 3000);
      alert("✅ Pengaturan telah dikembalikan ke default!");
    } catch (err: any) {
      alert("Gagal reset pengaturan: " + (err?.message || "Error"));
    }
  };

  // Handler tes ping koneksi ke Supabase Database secara riil
  const handleTestSupabaseConnection = async () => {
    setTestingDbStatus("Menguji koneksi...");
    try {
      const startTime = performance.now();
      const { error } = await supabase.from('branch_devices').select('id').limit(1);
      const latency = Math.round(performance.now() - startTime);
      if (!error) {
        setTestingDbStatus(`✅ Terhubung (Latency: ${latency}ms)`);
      } else {
        setTestingDbStatus(`⚠️ Gagal: ${error.message}`);
      }
    } catch (err: any) {
      setTestingDbStatus(`❌ Error: ${err?.message || 'Koneksi gagal'}`);
    }
  };

  // Handler uji coba pengiriman notifikasi ke Telegram Bot
  const handleTestTelegramAlert = async () => {
    setTestingTelegramStatus("Menguji alert...");
    try {
      if (settings.telegramBotToken?.trim()) {
        const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken.trim()}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: settings.telegramChatId.trim(),
            text: `🚨 [TEST UJI COBA BOT TELEGRAM]\n\nOutlet: Nitrogen Al-Kahfi (${selectedBranch})\nStatus: LIVE & NORMAL\nWaktu: ${new Date().toLocaleString('id-ID')}\n\nPesan tes ini dikirim langsung dari Menu Pengaturan Dashboard Owner.`
          })
        });
        const json = await res.json();
        if (json.ok) {
          setTestingTelegramStatus("✅ Berhasil terkirim via Telegram API!");
          alert(`✅ Pesan uji coba berhasil dikirim ke chat ID ${settings.telegramChatId} via Bot Telegram!`);
        } else {
          setTestingTelegramStatus(`⚠️ Gagal: ${json.description || 'Cek token/chat ID'}`);
          alert(`Gagal kirim via Telegram API: ${json.description || 'Cek token/chat ID'}`);
        }
      } else {
        await supabase.from('transactions').insert({
          total_amount: 0,
          payment_status: 'FRAUD_ALERT',
          payment_method: JSON.stringify({
            title: "Uji Coba Alert Bot Telegram",
            branch: selectedBranch === "Semua Cabang" ? "Tambun 1" : selectedBranch,
            cashier: "Owner",
            description: `Uji coba alert keamanan ke ${settings.telegramBotUsername} (Chat ID: ${settings.telegramChatId}) dari Pengaturan Sistem.`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          }),
          branch_id: selectedBranch === "Semua Cabang" ? "Tambun 1" : selectedBranch
        });
        setTestingTelegramStatus(`✅ Alert tercatat & disalurkan ke ${settings.telegramBotUsername}`);
        alert(`✅ Notifikasi uji coba berhasil disalurkan ke ${settings.telegramBotUsername} (Chat ID: ${settings.telegramChatId})!`);
      }
    } catch (err: any) {
      setTestingTelegramStatus(`❌ Error: ${err?.message || 'Gagal kirim'}`);
      alert("Gagal mengirim pesan uji coba: " + (err?.message || "Error"));
    }
  };

  // Handler untuk menghapus gambar rekaman CCTV transaksi
  const handleDeleteCctvSnapshot = async (snap: any) => {
    if (!confirm(`Hapus foto bukti rekaman CCTV untuk ${snap.id} (${snap.branch})?\nGambar akan dihapus permanen dari audit log.`)) return;
    try {
      const targetId = snap.rawId || snap.id;
      if (targetId && !String(targetId).startsWith('trx-demo')) {
        const { error } = await supabase
          .from('transactions')
          .update({ snapshot_url: null })
          .eq('id', targetId);
        if (error) console.warn("Supabase update warning:", error);
      }
      setRawTransactions(prev => prev.map(t => (t.id === targetId || t.id === snap.rawId) ? { ...t, snapshot_url: null } : t));
      setSnapshots(prev => prev.filter(s => (s.rawId || s.id) !== targetId));
      alert("✅ Gambar rekaman CCTV berhasil dihapus!");
    } catch (err: any) {
      alert("Gagal menghapus gambar CCTV: " + (err?.message || "Error"));
    }
  };

  // Handler untuk membersihkan semua gambar CCTV periode/cabang saat ini
  const handleClearAllCctvSnapshots = async () => {
    if (filteredAuditSnapshots.length === 0) {
      alert("Tidak ada rekaman CCTV untuk dihapus.");
      return;
    }
    const msg = selectedBranch === "Semua Cabang"
      ? `Hapus SEMUA (${filteredAuditSnapshots.length}) gambar rekaman CCTV pada periode ini?`
      : `Hapus semua (${filteredAuditSnapshots.length}) gambar rekaman CCTV untuk cabang ${selectedBranch}?`;
    if (!confirm(msg + "\nTindakan ini tidak dapat dibatalkan.")) return;

    try {
      const idsToClear = filteredAuditSnapshots.map(s => s.rawId || s.id);
      for (const id of idsToClear) {
        if (!String(id).startsWith('trx-demo')) {
          await supabase.from('transactions').update({ snapshot_url: null }).eq('id', id);
        }
      }
      setRawTransactions(prev => prev.map(t => idsToClear.includes(t.id) ? { ...t, snapshot_url: null } : t));
      setSnapshots(prev => prev.filter(s => !idsToClear.includes(s.rawId || s.id)));
      alert("✅ Seluruh gambar bukti CCTV berhasil dihapus!");
    } catch (err: any) {
      alert("Gagal menghapus gambar CCTV: " + (err?.message || "Error"));
    }
  };

  // Handler untuk menghapus log fraud telegram
  const handleDeleteFraudLog = async (alertItem: any) => {
    if (!confirm(`Hapus log peringatan fraud "${alertItem.title}" (${alertItem.time} di ${alertItem.branch})?`)) return;
    try {
      const targetId = alertItem.id;
      if (targetId && !String(targetId).startsWith('fraud-')) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', targetId);
        if (error) console.warn("Supabase delete warning:", error);
      }
      setRawTransactions(prev => prev.filter(t => t.id !== targetId));
      setFraudLogs(prev => prev.filter(f => f.id !== targetId));
      alert("✅ Log peringatan fraud berhasil dihapus!");
    } catch (err: any) {
      alert("Gagal menghapus log fraud: " + (err?.message || "Error"));
    }
  };


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
            <h2 className="text-2xl font-black text-gray-900 capitalize">
              {activeTab === 'overview' && 'Dashboard Executive'}
              {activeTab === 'cabang' && 'Manajemen Cabang'}
              {activeTab === 'audit' && 'Audit CCTV & Log Fraud Telegram'}
              {activeTab === 'stock' && 'Master Produk & Stok'}
              {activeTab === 'karyawan' && 'Manajemen Karyawan & Shift'}
              {activeTab === 'crm' && 'CRM Pelanggan'}
              {activeTab === 'keuangan' && 'Laporan Keuangan'}
              {activeTab === 'pengaturan' && 'Pengaturan Sistem'}
            </h2>
            <p className="text-gray-700 text-sm font-medium">
              {activeTab === 'overview' ? (
                selectedBranch === 'Semua Cabang' 
                  ? `Ringkasan operasional 4 cabang periode ${selectedPeriod === 'today' ? 'hari ini' : selectedPeriod === 'yesterday' ? 'kemarin' : selectedPeriod === '7days' ? '7 hari terakhir' : 'bulan ini'}.` 
                  : `Memantau operasional khusus cabang ${selectedBranch} periode ${selectedPeriod === 'today' ? 'hari ini' : selectedPeriod === 'yesterday' ? 'kemarin' : selectedPeriod === '7days' ? '7 hari terakhir' : 'bulan ini'}.`
              ) : 'Real-time data synchronization via Supabase.'}
            </p>
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border">
              <Calendar size={16} className="text-gray-700 mr-2 shrink-0" />
              <select 
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="bg-transparent text-sm font-bold text-gray-900 outline-none w-full md:w-auto cursor-pointer"
              >
                <option value="today">Hari Ini{todayLabel ? ` (${todayLabel})` : ''}</option>
                <option value="yesterday">Kemarin</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="month">Bulan Ini</option>
              </select>
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 border">
              <Building2 size={16} className="text-gray-700 mr-2 shrink-0" />
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-900 outline-none w-full md:w-auto cursor-pointer"
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
                       <p className="text-xs text-gray-700 font-bold mb-1">
                         Omzet {selectedPeriod === 'today' ? 'Hari Ini' : selectedPeriod === 'yesterday' ? 'Kemarin' : selectedPeriod === '7days' ? '7 Hari' : 'Bulan Ini'}
                       </p>
                       <p className="font-black text-blue-700 text-2xl">Rp {branch.omzet.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="px-5 pb-5 space-y-2">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 font-bold flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>Transaksi Nitrogen</span>
                          <span className="font-bold text-gray-700">{branch.trx}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 font-bold flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>Unit Oli Terpotong</span>
                          <span className="font-bold text-gray-700">{Math.floor(branch.trx * 0.2)}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm pt-1">
                          <span className="text-gray-700 font-bold flex items-center"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>IoT Status</span>
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
                           <p className="text-xs text-gray-700 font-bold mt-1">{snap.time}</p>
                        </div>
                     ))}
                     {displayedSnapshots.length === 0 && (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm font-bold">Belum ada tangkapan layar.</div>
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
                              <span className="text-xs text-gray-700 mt-1 font-bold group-hover:text-blue-600">Detail &rarr;</span>
                           </div>
                        </div>
                     ))}
                     {displayedFraudLogs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-8">
                           <CheckCircle size={28} className="text-emerald-500 mb-2 opacity-80" />
                           <p className="text-xs md:text-sm font-bold text-gray-700">Tidak Ada Fraud Terdeteksi</p>
                           <p className="text-xs text-gray-700 mt-0.5 font-medium">Semua transaksi & mesin {selectedBranch} berjalan normal.</p>
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
                  {auditView === "cctv" && filteredAuditSnapshots.length > 0 && (
                    <button 
                      onClick={handleClearAllCctvSnapshots}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                      title="Hapus semua foto CCTV periode ini"
                    >
                      <Trash2 size={13} />
                      <span>Hapus Semua Foto</span>
                    </button>
                  )}
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
                    <div key={snap.id || i} onClick={() => setSelectedSnapshot(snap.img || snap.url)} className="bg-white rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm hover:shadow-lg transition-all group cursor-pointer relative flex flex-col justify-between">
                      <div className="relative aspect-video bg-gray-900 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={snap.img || snap.url} alt="CCTV" className="object-cover w-full h-full opacity-85 group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white flex items-center">
                          <Camera size={12} className="mr-1 text-red-400" /> Bukti CCTV
                        </div>
                        {/* Tombol Hapus Pojok Foto */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCctvSnapshot(snap);
                          }}
                          title="Hapus foto bukti CCTV ini"
                          className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg shadow-md transition-all sm:opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">{snap.id}</span>
                            <h3 className="font-black text-gray-900 mt-2 text-lg">Rp {snap.amount.toLocaleString('id-ID')}</h3>
                          </div>
                          <span className="text-sm font-bold text-gray-700">{snap.time}</span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-700 font-semibold">
                          <span className="flex items-center"><Building2 size={12} className="mr-1 text-gray-500"/> {snap.branch}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCctvSnapshot(snap);
                            }}
                            className="text-red-600 hover:text-red-800 font-bold hover:underline flex items-center space-x-1"
                          >
                            <Trash2 size={12} />
                            <span>Hapus Foto</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredAuditSnapshots.length === 0 && (
                    <div className="col-span-full py-16 text-center text-gray-600 font-bold">
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
                        <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
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
                              <p className="text-xs text-gray-700 font-medium flex items-center mt-0.5">
                                <Building2 size={11} className="mr-1" /> {alert.branch}
                              </p>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-red-700 text-sm flex items-center">
                                <AlertCircle size={14} className="mr-1.5 shrink-0" />
                                {alert.title}
                              </p>
                              <p className="text-xs text-gray-700 font-medium max-w-md truncate mt-0.5">
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
                            <td className="p-4 text-right">
                              <div className="flex justify-end items-center space-x-2">
                                <button 
                                  onClick={() => setSelectedFraudModal(alert)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                >
                                  Detail & CCTV
                                </button>
                                <button
                                  onClick={() => handleDeleteFraudLog(alert)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg border border-red-200 text-xs font-bold transition-all"
                                  title="Hapus log fraud ini"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredAuditFraud.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-12 text-center text-gray-600 font-bold">
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
              <div className="p-5 border-b bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-extrabold text-xl text-gray-900">Master Data Produk & Stok</h3>
                  <p className="text-xs text-gray-500 font-medium">Kelola katalog layanan, stok barang ritel, dan barcode</p>
                </div>
                <div className="flex items-center space-x-2.5">
                  <button 
                    onClick={() => {
                      setOwnerScannerActive(!ownerScannerActive);
                      setScannedProductResult(null);
                      setScannedBarcode("");
                    }} 
                    className={`px-3.5 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer ${
                      ownerScannerActive ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ScanLine size={16} />
                    <span>{ownerScannerActive ? "Tutup Scanner" : "Scan Barcode Produk"}</span>
                  </button>
                  <button 
                    onClick={() => {
                      setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen', barcode: '' });
                      setShowProductModal(true);
                    }} 
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    + Tambah Produk
                  </button>
                </div>
              </div>

              {/* Barcode Scanner Box di Menu Owner */}
              {ownerScannerActive && (
                <div className="p-5 bg-slate-900 text-white border-b border-slate-800 space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl">
                        <ScanLine size={20} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-white">Scanner Barcode Produk (Cari / Cek Produk)</h4>
                        <p className="text-xs text-slate-400">Scan barcode fisik menggunakan USB Scanner Gun atau ketik kode barcode</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setOwnerScannerActive(false)}
                      className="text-slate-400 hover:text-white text-xs font-bold px-3 py-1 bg-slate-800 rounded-lg cursor-pointer"
                    >
                      ✕ Tutup Scanner
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Input Scan Barcode */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
                        Input / Scan Barcode (Tekan Enter atau Tembak Scanner)
                      </label>
                      <div className="flex space-x-2">
                        <input 
                          type="text" 
                          autoFocus
                          value={scannedBarcode}
                          onChange={e => setScannedBarcode(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = scannedBarcode.trim();
                              if (!trimmed) return;
                              const found = products.find(p => 
                                (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) || 
                                String(p.id) === trimmed || 
                                p.name.toLowerCase() === trimmed.toLowerCase()
                              );
                              if (found) {
                                setScannedProductResult(found);
                              } else {
                                setScannedProductResult({ notFound: true, code: trimmed });
                              }
                            }
                          }}
                          placeholder="Arahkan scanner / ketik: 899..."
                          className="flex-1 bg-slate-800 border-2 border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-white font-mono font-bold text-sm outline-none placeholder:text-slate-500 placeholder:font-sans"
                        />
                        <button 
                          onClick={() => {
                            const trimmed = scannedBarcode.trim();
                            if (!trimmed) return;
                            const found = products.find(p => 
                              (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) || 
                              String(p.id) === trimmed || 
                              p.name.toLowerCase() === trimmed.toLowerCase()
                            );
                            if (found) {
                              setScannedProductResult(found);
                            } else {
                              setScannedProductResult({ notFound: true, code: trimmed });
                            }
                          }}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
                        >
                          Cari
                        </button>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-slate-400 mb-1.5">⚡ Uji Cepat Barcode Terdaftar (Klik untuk test):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {products.filter(p => p.barcode).slice(0, 6).map(p => (
                            <button 
                              key={p.id}
                              onClick={() => {
                                setScannedBarcode(p.barcode);
                                setScannedProductResult(p);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-mono text-blue-300 transition-colors cursor-pointer"
                            >
                              {p.barcode} ({p.name})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Result Card */}
                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 flex flex-col justify-center">
                      {scannedProductResult ? (
                        scannedProductResult.notFound ? (
                          <div className="text-center py-2">
                            <p className="text-sm font-bold text-amber-400">⚠️ Barcode Belum Terdaftar</p>
                            <p className="text-xs text-slate-300 mt-1 font-mono">Kode: {scannedProductResult.code}</p>
                            <button 
                              onClick={() => {
                                setNewProduct({
                                  name: '',
                                  harga: 0,
                                  hpp: 0,
                                  stok: 0,
                                  img: '',
                                  category: 'ritel',
                                  barcode: scannedProductResult.code
                                });
                                setShowProductModal(true);
                              }}
                              className="mt-3 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                            >
                              + Daftarkan Sebagai Produk Baru
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <img src={scannedProductResult.img || "https://placehold.co/100x100"} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-700" />
                              <div>
                                <span className="text-xs text-emerald-400 font-bold flex items-center">
                                  <CheckCircle size={12} className="mr-1" /> Produk Ditemukan
                                </span>
                                <h5 className="font-extrabold text-sm text-white">{scannedProductResult.name}</h5>
                                <p className="text-xs text-slate-300">
                                  Harga: <b className="text-white">Rp {scannedProductResult.harga.toLocaleString('id-ID')}</b> | Stok: <b className="text-white">{scannedProductResult.stok}</b>
                                </p>
                                <p className="text-[11px] font-mono text-blue-300">Barcode: {scannedProductResult.barcode}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setNewProduct({ ...scannedProductResult });
                                setShowProductModal(true);
                              }}
                              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all shrink-0 ml-2 cursor-pointer shadow-sm"
                            >
                              ✏️ Edit Produk
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="text-center py-4 text-slate-400 text-xs flex flex-col items-center">
                          <ScanLine size={28} className="text-slate-600 mb-2" />
                          <span>Belum ada barcode yang discan. Tembak barcode scanner atau klik tombol uji di sebelah kiri.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
                      <th className="p-4 font-bold border-b">Nama Layanan / Barang</th>
                      <th className="p-4 font-bold border-b">Barcode / SKU</th>
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
                          {prod.barcode ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                              <ScanLine size={12} className="mr-1 text-slate-500" />
                              {prod.barcode}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Belum ada</span>
                          )}
                        </td>
                        <td className="p-4">
                          {prod.category === 'nitrogen' ? (
                            prod.name.toLowerCase().includes('mobil') ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
                                🚗 Nitrogen Mobil
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                🏍️ Nitrogen Motor
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              🛒 Ritel
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right font-semibold text-gray-700">Rp {prod.harga.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right font-bold text-gray-700">Rp {prod.hpp.toLocaleString('id-ID')}</td>
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
              {/* SISTEM EVALUASI KINERJA & SKEMA KOMISI KARYAWAN (KPI OTOMATIS) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-yellow-400/20 text-yellow-400 rounded-xl border border-yellow-400/30">
                        <Award size={22} className="text-yellow-400" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-lg text-white">Sistem Evaluasi Kinerja & Komisi Karyawan (KPI Otomatis)</h3>
                          <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <Sparkles size={11} /> Auto-Calculated
                          </span>
                        </div>
                        <p className="text-xs text-blue-200 font-medium mt-0.5">
                          Perhitungan otomatis insentif bonus & potongan komisi (+/- 25%) berbasis rata-rata omzet harian cabang
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
                    <button
                      onClick={() => setShowKpiSimulation(!showKpiSimulation)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border ${
                        showKpiSimulation 
                          ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-md' 
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                      }`}
                      title="Buka / Tutup kalkulator simulasi skenario omzet"
                    >
                      <Percent size={14} />
                      <span>{showKpiSimulation ? 'Tutup Simulasi' : 'Kalkulator Simulasi'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingKpiSettings({ ...kpiSettings });
                        setShowKpiSettingsModal(true);
                      }}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-blue-400/40 shadow-sm"
                      title="Atur target omzet cabang dan formula potongan / bonus"
                    >
                      <Settings size={14} />
                      <span>Atur Target & Skema</span>
                    </button>
                    <button
                      onClick={handleExportKpiExcel}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-emerald-400/40 shadow-sm"
                      title="Unduh laporan lengkap KPI dan komisi karyawan periode ini"
                    >
                      <Download size={14} />
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>

                {/* FORMULA & ATURAN AKTIF HIGHLIGHT BANNER */}
                <div className="bg-slate-50 border-b border-gray-200 p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-start space-x-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
                        <Target size={18} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Target Cabang Owner</div>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">
                          Rp {kpiSettings.monthlyTarget.toLocaleString('id-ID')} <span className="text-xs font-medium text-gray-700">/ bln</span>
                        </div>
                        <div className="text-xs text-blue-600 font-bold mt-0.5">
                          Rp {kpiSettings.dailyTarget.toLocaleString('id-ID')} / hari (standar 30 hari)
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-start space-x-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-0.5">
                        <TrendingUp size={18} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Aturan Bonus (Rata-rata &ge; Rp {kpiSettings.thresholdDaily.toLocaleString('id-ID')})</div>
                        <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                          Tambahan Komisi +{kpiSettings.operatorAdjustmentRate + kpiSettings.supervisorAdjustmentRate}%
                        </div>
                        <div className="text-xs text-gray-700 font-semibold mt-0.5">
                          +{kpiSettings.operatorAdjustmentRate}% Operator (Kasir) &bull; +{kpiSettings.supervisorAdjustmentRate}% Supervisor (SPV)
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-start space-x-3">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0 mt-0.5">
                        <TrendingDown size={18} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Aturan Potongan (Rata-rata &lt; Rp {kpiSettings.thresholdDaily.toLocaleString('id-ID')})</div>
                        <div className="text-base font-extrabold text-rose-700 mt-0.5">
                          Potongan Komisi -{kpiSettings.operatorAdjustmentRate + kpiSettings.supervisorAdjustmentRate}%
                        </div>
                        <div className="text-xs text-gray-700 font-semibold mt-0.5">
                          -{kpiSettings.operatorAdjustmentRate}% Operator (Kasir) &bull; -{kpiSettings.supervisorAdjustmentRate}% Supervisor (SPV)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* KALKULATOR SIMULASI SKENARIO OMZET */}
                {showKpiSimulation && (
                  <div className="bg-gradient-to-r from-amber-50/70 via-yellow-50/50 to-orange-50/60 p-5 border-b border-yellow-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Percent size={18} className="text-amber-600" />
                        <h4 className="font-extrabold text-gray-900 text-sm">Kalkulator Simulasi Perhitungan Kinerja & Komisi</h4>
                      </div>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                        Mode Pengujian Owner
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                      <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
                        <label className="block text-xs font-extrabold text-gray-700 mb-2">
                          Simulasikan Rata-rata Omset Harian Cabang:
                        </label>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-gray-500">Rp</span>
                          <input
                            type="number"
                            value={simulationDailyAvg}
                            onChange={(e) => setSimulationDailyAvg(Math.max(0, Number(e.target.value)))}
                            className="w-full font-black text-lg text-gray-900 border-2 border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="Contoh: 300000"
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setSimulationDailyAvg(200000)}
                            className="text-[11px] font-bold px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100 transition-all cursor-pointer"
                          >
                            Uji Rp 200rb (Di Bawah Target)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimulationDailyAvg(300000)}
                            className="text-[11px] font-bold px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-all cursor-pointer"
                          >
                            Uji Rp 300rb (Target Tercapai)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSimulationDailyAvg(500000)}
                            className="text-[11px] font-bold px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-all cursor-pointer"
                          >
                            Uji Rp 500rb (Target Penuh)
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Hasil Simulasi Operator */}
                        {(() => {
                          const isMet = simulationDailyAvg >= kpiSettings.thresholdDaily;
                          const simMonthlyOmzet = simulationDailyAvg * 30;
                          const baseKomisi = Math.round(simMonthlyOmzet * (kpiSettings.operatorBaseRate / 100));
                          const adjNominal = Math.round(baseKomisi * (kpiSettings.operatorAdjustmentRate / 100));
                          const netKomisi = isMet ? baseKomisi + adjNominal : Math.max(0, baseKomisi - adjNominal);
                          return (
                            <div className={`p-4 rounded-xl border ${isMet ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-xs text-gray-900">Peran: Operator (Kasir)</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMet ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}`}>
                                  {isMet ? `+${kpiSettings.operatorAdjustmentRate}% BONUS` : `-${kpiSettings.operatorAdjustmentRate}% POTONGAN`}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-gray-600 space-y-1">
                                <div className="flex justify-between">
                                  <span>Komisi Dasar ({kpiSettings.operatorBaseRate}%):</span>
                                  <span className="font-bold">Rp {baseKomisi.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Penyesuaian ({isMet ? '+' : '-'}{kpiSettings.operatorAdjustmentRate}%):</span>
                                  <span className={`font-bold ${isMet ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {isMet ? '+' : '-'}Rp {adjNominal.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-800">Komisi Bersih:</span>
                                <span className="text-base font-black text-gray-900">Rp {netKomisi.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Hasil Simulasi Supervisor */}
                        {(() => {
                          const isMet = simulationDailyAvg >= kpiSettings.thresholdDaily;
                          const simMonthlyOmzet = simulationDailyAvg * 30;
                          const baseKomisi = Math.round(simMonthlyOmzet * (kpiSettings.supervisorBaseRate / 100));
                          const adjNominal = Math.round(baseKomisi * (kpiSettings.supervisorAdjustmentRate / 100));
                          const netKomisi = isMet ? baseKomisi + adjNominal : Math.max(0, baseKomisi - adjNominal);
                          return (
                            <div className={`p-4 rounded-xl border ${isMet ? 'bg-purple-50/80 border-purple-200' : 'bg-rose-50/80 border-rose-200'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-xs text-gray-900">Peran: Supervisor (SPV)</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isMet ? 'bg-purple-200 text-purple-800' : 'bg-rose-200 text-rose-800'}`}>
                                  {isMet ? `+${kpiSettings.supervisorAdjustmentRate}% BONUS` : `-${kpiSettings.supervisorAdjustmentRate}% POTONGAN`}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-gray-600 space-y-1">
                                <div className="flex justify-between">
                                  <span>Komisi Dasar ({kpiSettings.supervisorBaseRate}%):</span>
                                  <span className="font-bold">Rp {baseKomisi.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Penyesuaian ({isMet ? '+' : '-'}{kpiSettings.supervisorAdjustmentRate}%):</span>
                                  <span className={`font-bold ${isMet ? 'text-purple-700' : 'text-rose-700'}`}>
                                    {isMet ? '+' : '-'}Rp {adjNominal.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-800">Komisi Bersih:</span>
                                <span className="text-base font-black text-gray-900">Rp {netKomisi.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* KARTU REALISASI KINERJA PER CABANG */}
                <div className="p-5 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                        <Building2 size={16} className="text-blue-600" />
                        Realisasi Kinerja & Ambang Batas Cabang (Periode: {selectedPeriod === 'today' ? 'Hari Ini' : selectedPeriod === 'yesterday' ? 'Kemarin' : selectedPeriod === '7days' ? '7 Hari Terakhir' : 'Bulan Ini'})
                      </h4>
                      <p className="text-xs text-gray-700 font-medium mt-0.5">
                        Rata-rata omzet dihitung dari total omset periode dibagi {kpiEvaluations.periodDays} hari aktif
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpiEvaluations.branchSummaries.map((b) => (
                      <div 
                        key={b.branchName} 
                        className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                          b.isTargetMet 
                            ? 'bg-emerald-50/30 border-emerald-300 hover:border-emerald-400' 
                            : 'bg-rose-50/20 border-rose-200 hover:border-rose-300'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-extrabold text-gray-900 text-sm truncate">{b.branchName}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              b.status === 'Online' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {b.status}
                            </span>
                          </div>

                          <div className="space-y-2 my-3">
                            <div>
                              <div className="text-[11px] font-bold text-gray-700 flex justify-between">
                                <span>Rata-rata Realisasi:</span>
                                <span className={`font-black text-sm ${b.isTargetMet ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  Rp {b.dailyAvg.toLocaleString('id-ID')} / hari
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 h-2 rounded-full mt-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${b.isTargetMet ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(100, b.targetAchievementPct)}%` }}
                                />
                              </div>
                            </div>

                            <div className="text-[11px] text-gray-700 space-y-1 pt-1 font-semibold">
                              <div className="flex justify-between">
                                <span>Target Standar:</span>
                                <span className="font-bold text-gray-900">Rp {b.dailyTarget.toLocaleString('id-ID')} / hari</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Ambang Batas KPI:</span>
                                <span className="font-bold text-gray-900">Rp {b.thresholdDaily.toLocaleString('id-ID')} / hari</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-gray-200">
                                <span>Total Omset ({b.periodDays} hr):</span>
                                <span className="font-bold text-gray-900">Rp {b.totalOmzet.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* BADGE EVALUASI HASIL */}
                        <div className={`mt-3 p-2.5 rounded-xl border text-center ${
                          b.isTargetMet 
                            ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900' 
                            : 'bg-rose-100/70 border-rose-300 text-rose-900'
                        }`}>
                          <div className="text-[11px] font-black flex items-center justify-center gap-1">
                            {b.isTargetMet ? (
                              <>
                                <CheckCircle size={13} className="text-emerald-700" />
                                <span>Target Tercapai: Bonus +25%</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={13} className="text-rose-700" />
                                <span>Di Bawah Target: Potongan -25%</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] font-bold opacity-90 mt-0.5">
                            {b.isTargetMet 
                              ? `+${b.operatorAdjustmentRate}% Operator • +${b.supervisorAdjustmentRate}% SPV` 
                              : `-${b.operatorAdjustmentRate}% Operator • -${b.supervisorAdjustmentRate}% SPV`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TABEL RINCIAN EVALUASI & KOMISI KARYAWAN */}
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                        <Users size={16} className="text-indigo-600" />
                        Rincian Perhitungan Komisi Karyawan (Operator & Supervisor)
                      </h4>
                      <p className="text-xs text-gray-700 font-medium mt-0.5">
                        Komisi bersih dihitung otomatis berdasarkan skema bonus/potongan 25% cabang masing-masing
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 self-stretch sm:self-auto">
                      <select
                        value={kpiBranchFilter}
                        onChange={(e) => setKpiBranchFilter(e.target.value)}
                        className="text-xs font-bold border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-900 outline-none"
                      >
                        <option value="Semua Cabang">Semua Cabang</option>
                        {branchStats.map(b => (
                          <option key={b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>

                      <select
                        value={kpiRoleFilter}
                        onChange={(e) => setKpiRoleFilter(e.target.value as any)}
                        className="text-xs font-bold border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-900 outline-none"
                      >
                        <option value="ALL">Semua Jabatan</option>
                        <option value="Operator">Operator (Kasir)</option>
                        <option value="Supervisor">Supervisor (SPV)</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                      <thead>
                        <tr className="bg-gray-100 text-gray-800 uppercase tracking-wider font-extrabold border-b">
                          <th className="p-3.5">Nama Karyawan</th>
                          <th className="p-3.5">Jabatan</th>
                          <th className="p-3.5">Cabang</th>
                          <th className="p-3.5 text-right">Rata2 Omset Cabang</th>
                          <th className="p-3.5 text-right">Komisi Dasar</th>
                          <th className="p-3.5 text-center">Skema KPI</th>
                          <th className="p-3.5 text-right">Penyesuaian</th>
                          <th className="p-3.5 text-right">Komisi Bersih</th>
                          <th className="p-3.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const filtered = kpiEvaluations.employeeEvaluations.filter(emp => {
                            if (kpiBranchFilter !== "Semua Cabang" && emp.branch.toLowerCase() !== kpiBranchFilter.toLowerCase()) return false;
                            if (kpiRoleFilter !== "ALL" && emp.role !== kpiRoleFilter) return false;
                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={9} className="p-6 text-center text-gray-500 font-bold">
                                  Tidak ada data karyawan yang sesuai filter.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3.5 font-bold text-gray-900 flex items-center space-x-2.5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                                  emp.role === 'Supervisor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {emp.name ? emp.name[0] : 'K'}
                                </div>
                                <span className="font-extrabold">{emp.name}</span>
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                  emp.role === 'Supervisor' 
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {emp.role === 'Supervisor' ? 'Supervisor (SPV)' : 'Operator (Kasir)'}
                                </span>
                              </td>
                              <td className="p-3.5 font-semibold text-gray-700">
                                <div className="flex items-center">
                                  <Building2 size={12} className="mr-1 text-gray-500" />
                                  <span>{emp.branch}</span>
                                </div>
                              </td>
                              <td className="p-3.5 text-right">
                                <div className={`font-bold ${emp.isTargetMet ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  Rp {emp.branchDailyAvg.toLocaleString('id-ID')} / hr
                                </div>
                                <div className="text-[10px] text-gray-600">Ambang: Rp {emp.thresholdDaily.toLocaleString('id-ID')}</div>
                              </td>
                              <td className="p-3.5 text-right font-bold text-gray-800">
                                <div>Rp {emp.baseCommission.toLocaleString('id-ID')}</div>
                                <div className="text-[10px] text-gray-600 font-normal">Rate: {emp.baseRate}%</div>
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-[11px] ${
                                  emp.isBonus 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {emp.isBonus ? `+${emp.adjRate}% Bonus` : `-${emp.adjRate}% Potongan`}
                                </span>
                              </td>
                              <td className="p-3.5 text-right font-black">
                                <span className={emp.isBonus ? 'text-emerald-700' : 'text-rose-700'}>
                                  {emp.isBonus ? '+' : '-'} Rp {emp.adjustmentAmount.toLocaleString('id-ID')}
                                </span>
                              </td>
                              <td className="p-3.5 text-right font-black text-sm">
                                <span className="bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 inline-block font-mono">
                                  Rp {emp.netCommission.toLocaleString('id-ID')}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                {emp.isTargetMet ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                    <CheckCircle size={11} className="mr-1 text-emerald-600" /> Tercapai
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                    <AlertCircle size={11} className="mr-1 text-rose-600" /> Di Bawah Target
                                  </span>
                                )}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* LOG ABSENSI MASUK KARYAWAN */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <Camera size={18} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800">Log Absensi Wajah Kasir (Face Attendance)</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
                      {displayedAttendances.length} Catatan Absen
                    </span>
                    {displayedAttendances.length > 0 && (
                      <button 
                        onClick={handleClearAllAttendances}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                        title="Hapus semua riwayat absensi periode ini"
                      >
                        <Trash2 size={12} />
                        <span>Hapus Semua</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {displayedAttendances.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 font-bold text-sm">
                      Belum ada rekaman foto absensi masuk kasir hari ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {displayedAttendances.map((att, i) => (
                        <div 
                          key={att.id || i} 
                          onClick={() => setSelectedSnapshot(att.img || att.url)}
                          className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group relative flex flex-col justify-between"
                        >
                          <div className="aspect-square bg-gray-200 relative overflow-hidden">
                            <img 
                              src={att.img || att.url} 
                              alt={att.cashier} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                              {att.time}
                            </div>
                            {/* Tombol Hapus Pojok Foto */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAttendance(att);
                              }}
                              title="Hapus catatan absen ini"
                              className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg shadow-md transition-all sm:opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="p-2.5 bg-gray-50/50 flex-1 flex flex-col justify-between">
                            <div>
                              <p className="font-bold text-gray-900 text-xs truncate">{att.cashier}</p>
                              <p className="text-xs text-gray-700 font-medium flex items-center mt-0.5">
                                <Building2 size={10} className="mr-1 shrink-0" />
                                <span className="truncate">{att.branch}</span>
                              </p>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-200/60">
                              <p className="text-[10px] text-emerald-700 font-bold flex items-center">
                                <CheckCircle size={10} className="mr-1 text-emerald-600" /> Hadir
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAttendance(att);
                                }}
                                className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline flex items-center space-x-0.5"
                              >
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* KASIR & SPV SETTINGS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800">Manajemen Karyawan & Hak Akses (Operator & SPV)</h3>
                    <p className="text-xs text-gray-700 font-medium mt-0.5">Daftar operator kasir dan supervisor cabang dengan PIN akses dan persentase komisi dasar</p>
                  </div>
                  <button 
                    onClick={() => {
                      setNewOperator({ 
                        name: '', 
                        pin: '', 
                        branch: branchStats.length > 0 ? branchStats[0].name : '', 
                        role: 'Operator', 
                        baseCommissionRate: 5 
                      });
                      setShowOperatorModal(true);
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
                  >
                    + Tambah Karyawan
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
                        <th className="p-4 font-bold border-b">Nama Lengkap</th>
                        <th className="p-4 font-bold border-b">Jabatan</th>
                        <th className="p-4 font-bold border-b">PIN Akses</th>
                        <th className="p-4 font-bold border-b">Cabang Penempatan</th>
                        <th className="p-4 font-bold border-b text-center">Komisi Dasar</th>
                        <th className="p-4 font-bold border-b text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedOperators.map((op) => {
                        const isSpv = op.role === 'Supervisor' || (op.name && (op.name.toLowerCase().includes('spv') || op.name.toLowerCase().includes('supervisor')));
                        const role = op.role || (isSpv ? 'Supervisor' : 'Operator');
                        const baseRate = op.baseCommissionRate !== undefined ? op.baseCommissionRate : (isSpv ? 3 : 5);

                        return (
                          <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-gray-900 flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                role === 'Supervisor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {op.name[0]}
                              </div>
                              <span>{op.name}</span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                role === 'Supervisor' 
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {role === 'Supervisor' ? 'Supervisor (SPV)' : 'Operator (Kasir)'}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-gray-700 font-bold">{op.pin}</td>
                            <td className="p-4 font-semibold text-gray-600">{op.branch}</td>
                            <td className="p-4 text-center font-mono font-bold text-gray-800">
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                {baseRate}%
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end items-center space-x-2">
                                <button
                                  onClick={() => {
                                    setNewOperator({ 
                                      ...op, 
                                      role, 
                                      baseCommissionRate: baseRate 
                                    });
                                    setShowOperatorModal(true);
                                  }}
                                  className="text-blue-600 font-bold text-sm hover:text-blue-800 cursor-pointer"
                                >
                                  Edit
                                </button>
                                <span className="text-gray-300">|</span>
                                <button 
                                  onClick={() => {
                                    if (confirm(`Hapus data karyawan ${op.name}?`)) {
                                      const newOps = operators.filter(o => o.id !== op.id);
                                      setOperators(newOps);
                                      saveOperators(newOps);
                                      alert(`Akses karyawan ${op.name} berhasil dicabut!`);
                                    }
                                  }}
                                  className="text-red-600 font-bold text-sm hover:text-red-800 cursor-pointer"
                                >
                                  Cabut Akses
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            {/* SHIFT AUDIT */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
              <div className="p-5 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Log Discrepancy & Blind Closing</h3>
                <button onClick={handleExportShiftExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition-all flex items-center space-x-1.5"><Download size={14} /><span>Download Excel</span></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
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
                        <td colSpan={7} className="p-8 text-center text-gray-600 font-bold">
                          Belum ada laporan shift yang ditutup hari ini.
                        </td>
                      </tr>
                    ) : (
                      displayedShifts.map((shift, i) => (
                        <tr key={shift.id || i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-bold text-gray-900">{shift.id}</td>
                          <td className="p-4">
                            <div className="font-bold text-gray-800">{shift.date}</div>
                            <div className="text-xs text-gray-700 font-bold flex items-center mt-1"><Building2 size={10} className="mr-1"/> {shift.branch}</div>
                          </td>
                          <td className="p-4 font-semibold text-gray-700 flex items-center space-x-2 pt-6">
                             <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{shift.cashier ? shift.cashier[0] : '-'}</div>
                             <span>{shift.cashier}</span>
                          </td>
                          <td className="p-4 text-right font-bold text-gray-700">Rp {shift.modal.toLocaleString('id-ID')}</td>
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
                      <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
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
                                <div className="text-xs text-gray-700 font-medium mt-1">
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
               <div className="p-5 border-b bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-gray-800 text-lg">Database Pelanggan (Loyalti)</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
                      {displayedCustomers.length} Pelanggan
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                     <div className="relative flex-1 sm:w-64">
                        <Search size={16} className="absolute left-3 top-3 text-gray-500" />
                        <input 
                          type="text" 
                          value={crmSearch}
                          onChange={(e) => setCrmSearch(e.target.value)}
                          placeholder="Cari Plat Nomor / No. HP..." 
                          className="pl-9 pr-4 py-2 w-full border-2 border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-blue-500 bg-white text-gray-900" 
                        />
                     </div>
                     <button 
                       onClick={handleExportCrmExcel}
                       className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                       title="Download Data Pelanggan CSV"
                     >
                       <Download size={13} />
                       <span className="hidden sm:inline">CSV</span>
                     </button>
                     <button 
                       onClick={() => {
                         setNewCustomer({ plat: '', phone: '', fav: 'Isi Baru Motor', poin: 10, kunjung: 1, branch: selectedBranch === 'Semua Cabang' ? 'Tambun 1' : selectedBranch });
                         setShowCustomerModal(true);
                       }}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                     >
                       <span>+ Tambah Pelanggan</span>
                     </button>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse whitespace-nowrap">
                   <thead>
                     <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
                       <th className="p-4 font-bold border-b">Plat Kendaraan</th>
                       <th className="p-4 font-bold border-b text-center">Kunjungan</th>
                       <th className="p-4 font-bold border-b">Terakhir Kunjung</th>
                       <th className="p-4 font-bold border-b">Layanan Favorit</th>
                       <th className="p-4 font-bold border-b text-right">Total Poin</th>
                       <th className="p-4 font-bold border-b text-right">Aksi & Program</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {displayedCustomers.map((user: any, i: number) => {
                       const cleanPhone = (user.phone || '').replace(/\D/g, '');
                       const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(`Halo Kak! Terima kasih telah berkunjung ke Outlet Nitrogen Al-Kahfi. Poin loyalti kendaraan ${user.plat} Anda saat ini: ${user.poin || 0} pts. Kunjungi outlet kami dan tukarkan dengan hadiah spesial!`)}` : null;
                       return (
                         <tr key={user.id || user.plat || i} className="hover:bg-slate-50 transition-colors">
                           <td className="p-4 font-bold text-gray-900">
                             <div className="flex flex-col">
                               <div className="bg-gray-900 text-white px-2.5 py-1 rounded-md text-xs font-mono font-black border-b-2 border-white ring-2 ring-gray-900 w-fit">
                                 {user.plat}
                               </div>
                               {user.phone && (
                                 <span className="text-[11px] text-gray-600 font-bold mt-1 flex items-center">
                                   <Phone size={10} className="mr-1 text-gray-400" /> {user.phone}
                                 </span>
                               )}
                             </div>
                           </td>
                           <td className="p-4 font-extrabold text-gray-800 text-center">{user.kunjung || 1}x</td>
                           <td className="p-4 text-sm text-gray-700 font-bold">{user.last || '-'}</td>
                           <td className="p-4 text-sm text-gray-700 font-semibold">{user.fav || 'Layanan Nitrogen'}</td>
                           <td className="p-4 text-right">
                             <span className="font-black text-blue-600 text-base">{user.poin || 0}</span>
                             <span className="text-xs font-bold text-gray-500 ml-1">pts</span>
                           </td>
                           <td className="p-4 text-right">
                             <div className="flex justify-end items-center space-x-1.5">
                               {waLink ? (
                                 <a 
                                   href={waLink} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                                   title="Kirim Pesan WhatsApp / Promo"
                                 >
                                   <MessageSquare size={13} />
                                   <span>WA</span>
                                 </a>
                               ) : null}
                               <button 
                                 onClick={() => setShowRedeemModal(user)}
                                 className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                                 title="Tukar Hadiah Poin Loyalti"
                               >
                                 <Gift size={13} />
                                 <span>Tukar Poin</span>
                               </button>
                               <button 
                                 onClick={() => {
                                   setNewCustomer({
                                     id: user.id,
                                     plat: user.plat,
                                     phone: user.phone || '',
                                     fav: user.fav || 'Isi Baru Motor',
                                     poin: user.poin || 0,
                                     kunjung: user.kunjung || 1,
                                     branch: user.branch || (selectedBranch === 'Semua Cabang' ? 'Tambun 1' : selectedBranch)
                                   });
                                   setShowCustomerModal(true);
                                 }}
                                 className="px-2 py-1.5 text-blue-600 hover:text-blue-800 text-xs font-bold hover:bg-blue-50 rounded-lg transition-all"
                               >
                                 Edit
                               </button>
                               <button 
                                 onClick={() => handleDeleteCustomer(user)}
                                 className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all"
                                 title="Hapus Pelanggan"
                               >
                                 <Trash2 size={13} />
                               </button>
                             </div>
                           </td>
                         </tr>
                       );
                     })}
                     {displayedCustomers.length === 0 && (
                       <tr>
                         <td colSpan={6} className="p-12 text-center text-gray-600 font-bold">
                           Belum ada data pelanggan yang cocok dengan pencarian / cabang yang dipilih.
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === "keuangan" && (
            <div className="space-y-6">
               {/* 4 Kartu Metrik Utama Keuangan */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <div className="flex items-center justify-between mb-1">
                       <p className="text-gray-700 font-extrabold text-sm">
                         Total Pemasukan ({selectedPeriod === 'today' ? 'Hari Ini' : selectedPeriod === 'yesterday' ? 'Kemarin' : selectedPeriod === '7days' ? '7 Hari Terakhir' : 'Bulan Ini'})
                       </p>
                       <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                         <DollarSign size={18} />
                       </span>
                     </div>
                     <h2 className="text-2xl font-black text-blue-600 mb-2">Rp {stats.omzet.toLocaleString('id-ID')}</h2>
                     <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 text-xs">
                       <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                         💵 Rp {totalCash.toLocaleString('id-ID')}
                       </span>
                       <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold border border-purple-200">
                         📱 Rp {totalQris.toLocaleString('id-ID')}
                       </span>
                     </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <div className="flex items-center justify-between mb-1">
                       <p className="text-gray-700 font-extrabold text-sm">Total Pengeluaran (HPP)</p>
                       <span className="p-2 bg-red-50 text-red-600 rounded-lg">
                         <TrendingUp size={18} />
                       </span>
                     </div>
                     <h2 className="text-2xl font-black text-red-600 mb-2">Rp {Math.round(stats.omzet * 0.2).toLocaleString('id-ID')}</h2>
                     <p className="text-xs text-gray-600 font-medium pt-2 border-t border-gray-100">
                       Estimasi HPP barang & operasional (20%)
                     </p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <div className="flex items-center justify-between mb-1">
                       <p className="text-gray-700 font-extrabold text-sm">Laba Bersih Estimasi</p>
                       <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                         <CheckCircle size={18} />
                       </span>
                     </div>
                     <h2 className="text-2xl font-black text-emerald-600 mb-2">Rp {stats.profit.toLocaleString('id-ID')}</h2>
                     <p className="text-xs text-gray-600 font-medium pt-2 border-t border-gray-100">
                       Estimasi margin laba bersih (~80%)
                     </p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                     <div className="flex items-center justify-between mb-1">
                       <p className="text-gray-700 font-extrabold text-sm">Rata-rata Transaksi</p>
                       <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                         <ShoppingCart size={18} />
                       </span>
                     </div>
                     <h2 className="text-2xl font-black text-amber-600 mb-2">Rp {avgTrxAmount.toLocaleString('id-ID')}</h2>
                     <p className="text-xs text-gray-600 font-medium pt-2 border-t border-gray-100">
                       Dari total <strong className="text-gray-900">{displayedSales.length}</strong> transaksi berhasil
                     </p>
                  </div>
               </div>

               {/* Ringkasan Breakdown Metode Pembayaran */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                          <span className="text-xs font-bold uppercase text-emerald-900 tracking-wider">Metode Pembayaran Tunai (Cash)</span>
                        </div>
                        <h3 className="text-2xl font-black text-emerald-700 mt-2">Rp {totalCash.toLocaleString('id-ID')}</h3>
                        <p className="text-xs text-emerald-900 font-medium mt-1">
                          Kontribusi: {stats.omzet > 0 ? Math.round((totalCash / stats.omzet) * 100) : 0}% dari total pemasukan
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-black text-xs">
                        {cashSales.length} Transaksi
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                          <span className="text-xs font-bold uppercase text-purple-900 tracking-wider">Metode Pembayaran QRIS (Digital)</span>
                        </div>
                        <h3 className="text-2xl font-black text-purple-700 mt-2">Rp {totalQris.toLocaleString('id-ID')}</h3>
                        <p className="text-xs text-purple-900 font-medium mt-1">
                          Kontribusi: {stats.omzet > 0 ? Math.round((totalQris / stats.omzet) * 100) : 0}% dari total pemasukan
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 border border-purple-300 rounded-full font-black text-xs">
                        {qrisSales.length} Transaksi
                      </span>
                    </div>
                  </div>
               </div>

               {/* Tabel Riwayat Transaksi Penjualan Lengkap */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div>
                       <h3 className="font-bold text-gray-800 text-base">
                         Riwayat Transaksi Penjualan ({filteredFinanceSales.length} dari {displayedSales.length} Transaksi)
                       </h3>
                       <p className="text-xs text-gray-600 mt-0.5 font-medium">
                         Catatan transaksi riil cabang {selectedBranch} periode {selectedPeriod === 'today' ? 'hari ini' : selectedPeriod === 'yesterday' ? 'kemarin' : selectedPeriod === '7days' ? '7 hari terakhir' : 'bulan ini'}.
                       </p>
                     </div>
                     
                     <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                       {/* Input Pencarian */}
                       <div className="relative flex-1 md:w-64">
                         <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                         <input
                           type="text"
                           placeholder="Cari ID, cabang, nominal..."
                           value={financeSearch}
                           onChange={(e) => setFinanceSearch(e.target.value)}
                           className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                         />
                         {financeSearch && (
                           <button onClick={() => setFinanceSearch("")} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700">
                             <X size={14} />
                           </button>
                         )}
                       </div>

                       {/* Filter Metode Pembayaran */}
                       <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 text-xs font-bold">
                         <button
                           onClick={() => setFinancePaymentFilter("ALL")}
                           className={`px-3 py-1.5 rounded-md transition-all ${financePaymentFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                         >
                           Semua
                         </button>
                         <button
                           onClick={() => setFinancePaymentFilter("CASH")}
                           className={`px-3 py-1.5 rounded-md transition-all ${financePaymentFilter === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                         >
                           💵 Tunai
                         </button>
                         <button
                           onClick={() => setFinancePaymentFilter("QRIS")}
                           className={`px-3 py-1.5 rounded-md transition-all ${financePaymentFilter === 'QRIS' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                         >
                           📱 QRIS
                         </button>
                       </div>

                       {/* Tombol Export Excel */}
                       <button 
                         onClick={handleExportFinanceExcel} 
                         className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-md transition-all shrink-0"
                         title="Download Laporan Keuangan ke format CSV / Excel"
                       >
                         <Download size={15} className="mr-1.5" />
                         Export Excel
                       </button>
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-gray-100 text-gray-800 text-xs uppercase tracking-wider font-extrabold">
                          <th className="p-4 font-bold border-b">No</th>
                          <th className="p-4 font-bold border-b">ID Transaksi</th>
                          <th className="p-4 font-bold border-b">Waktu & Tanggal</th>
                          <th className="p-4 font-bold border-b">Cabang</th>
                          <th className="p-4 font-bold border-b">Metode Pembayaran</th>
                          <th className="p-4 font-bold border-b text-right">Nilai Transaksi</th>
                          <th className="p-4 font-bold border-b text-center">Status</th>
                          <th className="p-4 font-bold border-b text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredFinanceSales.map((trx, idx) => {
                          const isQris = (trx.payment_method || '').toUpperCase().includes('QRIS');
                          const branchName = (trx.branch_id === 'd0e659b9-0c62-4015-ab1b-265de35bfcd1' || !trx.branch_id) ? 'Tambun 1' : trx.branch_id;
                          return (
                            <tr key={trx.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 text-xs font-bold text-gray-600">{idx + 1}</td>
                              <td className="p-4 font-mono font-bold text-xs text-blue-700">
                                TRX-{String(trx.id || '').slice(0, 8)}
                              </td>
                              <td className="p-4 text-xs font-semibold text-gray-700">
                                {new Date(trx.created_at).toLocaleString('id-ID')}
                              </td>
                              <td className="p-4 text-xs font-bold text-gray-800">
                                {branchName}
                              </td>
                              <td className="p-4">
                                {isQris ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                    📱 QRIS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    💵 CASH (Tunai)
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-right font-black text-sm text-gray-900">
                                Rp {Number(trx.total_amount).toLocaleString('id-ID')}
                              </td>
                              <td className="p-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                  COMPLETED
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => handleDeleteTransaction(trx)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Hapus / Void Transaksi Ini"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredFinanceSales.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-12 text-center text-gray-600 font-bold">
                              {displayedSales.length === 0 
                                ? "Belum ada riwayat transaksi pada periode dan cabang yang dipilih."
                                : "Tidak ada transaksi yang cocok dengan kriteria pencarian/filter."}
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
            <div className="space-y-6 max-w-5xl">
              {/* Alert Notifikasi Sukses Simpan */}
              {settingsSavedSuccess && (
                <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 px-5 py-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="text-emerald-600 shrink-0" size={24} />
                    <div>
                      <p className="font-extrabold text-sm">Pengaturan Sistem Berhasil Disimpan!</p>
                      <p className="text-xs text-emerald-800">
                        Perubahan telah tersimpan secara permanen dan disinkronkan otomatis ke modul kasir dan cloud.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSettingsSavedSuccess(false)} className="text-emerald-700 hover:text-emerald-950 font-bold text-xs">
                    Tutup
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Kolom Kiri & Tengah: Form Konfigurasi (2 spans) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Card 1: Integrasi Cloud & Keamanan (Telegram & Supabase) */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b bg-gray-50/50 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                          <Settings size={18} />
                        </span>
                        <div>
                          <h3 className="font-extrabold text-gray-900 text-base">Integrasi Cloud & Keamanan</h3>
                          <p className="text-xs text-gray-600 font-medium">Koneksi Telegram Bot Alert & Database Supabase</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-5">
                      {/* Telegram Bot Security Alert */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-extrabold text-gray-800">
                            Bot Telegram Security Alert
                          </label>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800 border border-green-300">
                            ● Terhubung
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="block text-xs font-bold text-gray-600 mb-1">Username Bot</span>
                            <input
                              type="text"
                              value={settings.telegramBotUsername}
                              onChange={(e) => setSettings({ ...settings, telegramBotUsername: e.target.value })}
                              placeholder="@AlKahfiAlertBot"
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-mono text-sm focus:border-blue-500 focus:outline-none bg-white"
                            />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-gray-600 mb-1">Grup Chat ID Owner</span>
                            <input
                              type="text"
                              value={settings.telegramChatId}
                              onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                              placeholder="-10023481920"
                              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-mono text-sm focus:border-blue-500 focus:outline-none bg-white"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-600 font-medium">
                            Notifikasi indikasi fraud & selisih laci kasir otomatis disalurkan ke chat ID di atas.
                          </p>
                          <div className="flex items-center gap-2">
                            {testingTelegramStatus && (
                              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                                {testingTelegramStatus}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={handleTestTelegramAlert}
                              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="Kirim pesan uji coba langsung ke bot Telegram"
                            >
                              <Send size={13} />
                              <span>Uji Coba Alert Telegram</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* URL Database Supabase */}
                      <div className="pt-4 border-t border-gray-100">
                        <label className="block text-sm font-extrabold text-gray-800 mb-1">
                          URL Database Supabase (Cloud PostgreSQL)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={settings.supabaseUrl}
                            disabled
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-100 text-gray-600 cursor-not-allowed font-mono text-xs font-bold select-all"
                          />
                          <button
                            type="button"
                            onClick={handleTestSupabaseConnection}
                            className="shrink-0 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-lg border border-gray-300 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <span>Ping Database</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-xs text-gray-600 font-medium">
                            Koneksi aktif via Supabase JS Client & Realtime WebSocket.
                          </p>
                          {testingDbStatus && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {testingDbStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Profil Usaha & Format Struk */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b bg-gray-50/50 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                          <Printer size={18} />
                        </span>
                        <div>
                          <h3 className="font-extrabold text-gray-900 text-base">Profil Usaha & Format Struk Kasir</h3>
                          <p className="text-xs text-gray-600 font-medium">Pengaturan kop header struk thermal Bluetooth 58mm</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-extrabold text-gray-800 mb-1">
                          Nama Usaha / Perusahaan (Header Struk)
                        </label>
                        <input
                          type="text"
                          value={settings.companyName}
                          onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                          placeholder="Misal: Al-Kahfi Nitrogen & Oli"
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-gray-900 font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-extrabold text-gray-800 mb-1">
                            Alamat Outlet / Kantor
                          </label>
                          <input
                            type="text"
                            value={settings.companyAddress}
                            onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                            placeholder="Misal: Jl. Raya Tambun No. 88"
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-gray-900 font-medium text-sm outline-none focus:border-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-extrabold text-gray-800 mb-1">
                            Nomor WhatsApp / CS
                          </label>
                          <input
                            type="text"
                            value={settings.companyPhone}
                            onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                            placeholder="Misal: 0812-9876-5432"
                            className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-gray-900 font-medium text-sm outline-none focus:border-blue-500 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-extrabold text-gray-800 mb-1">
                          Catatan Kaki Struk (Footer Struk)
                        </label>
                        <input
                          type="text"
                          value={settings.receiptFooter}
                          onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                          placeholder="Pesan terima kasih, garansi, atau syarat & ketentuan..."
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-gray-900 font-medium text-sm outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Pengaturan Kiosk Kasir & Operasional */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b bg-gray-50/50 flex items-center justify-between">
                      <h3 className="font-extrabold text-gray-900 text-base">Pengaturan Mode Kiosk Kasir</h3>
                      <span className="text-xs font-bold text-gray-500">Standar POS Tablet</span>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Option 1: Auto Lock Idle */}
                      <div className="flex items-start justify-between p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50/40">
                        <label className="flex items-start space-x-3 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            checked={settings.autoLockIdle}
                            onChange={(e) => setSettings({ ...settings, autoLockIdle: e.target.checked })}
                            className="w-5 h-5 mt-0.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <p className="font-extrabold text-gray-900 text-sm">Otomatis Kunci Kasir saat Idle</p>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">
                              Layar kasir akan otomatis terkunci dan meminta PIN operator setelah tidak ada sentuhan layar.
                            </p>
                          </div>
                        </label>
                        {settings.autoLockIdle && (
                          <div className="flex items-center space-x-1.5 ml-4 shrink-0">
                            <select
                              value={settings.idleTimeoutMinutes}
                              onChange={(e) => setSettings({ ...settings, idleTimeoutMinutes: parseInt(e.target.value) || 5 })}
                              className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-800 outline-none cursor-pointer"
                            >
                              <option value={2}>2 Menit</option>
                              <option value={5}>5 Menit</option>
                              <option value={10}>10 Menit</option>
                              <option value={15}>15 Menit</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Option 2: Require Bluetooth Printer */}
                      <div className="p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50/40">
                        <label className="flex items-start space-x-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings.requireReceiptPrint}
                            onChange={(e) => setSettings({ ...settings, requireReceiptPrint: e.target.checked })}
                            className="w-5 h-5 mt-0.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <p className="font-extrabold text-gray-900 text-sm">Wajib Cetak Struk Transaksi</p>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">
                              Sistem kasir mewajibkan printer thermal Bluetooth terhubung sebelum tombol pelunasan aktif.
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Option 3: Face Attendance Requirement */}
                      <div className="p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50/40">
                        <label className="flex items-start space-x-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings.requireFaceAttendance}
                            onChange={(e) => setSettings({ ...settings, requireFaceAttendance: e.target.checked })}
                            className="w-5 h-5 mt-0.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <p className="font-extrabold text-gray-900 text-sm">Wajib Selfie Absensi Wajah Karyawan</p>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">
                              Karyawan kasir wajib mengambil foto bukti wajah saat absensi shift pagi dan tutup buku malam.
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Option 4: Telegram Fraud Dispatch */}
                      <div className="p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-gray-50/40">
                        <label className="flex items-start space-x-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings.telegramAlertEnabled}
                            onChange={(e) => setSettings({ ...settings, telegramAlertEnabled: e.target.checked })}
                            className="w-5 h-5 mt-0.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <p className="font-extrabold text-gray-900 text-sm">Otomatis Teruskan Indikasi Fraud ke Telegram</p>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">
                              Kirim broadcast alert instan saat selisih setoran kasir minus atau kompresor menyala tanpa transaksi POS.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: Live Struk Preview & Action Center (1 span) */}
                <div className="space-y-6">
                  {/* Live Receipt Preview */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Printer size={16} className="text-gray-700" />
                        <h4 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider">Simulasi Struk Kasir</h4>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                        Thermal 58mm
                      </span>
                    </div>

                    <div className="p-5 bg-amber-50/30 flex justify-center">
                      <div className="w-full max-w-[280px] bg-white border border-dashed border-gray-300 p-4 rounded-lg shadow-sm font-mono text-[11px] text-gray-800">
                        {/* Header */}
                        <div className="text-center pb-2 border-b border-dashed border-gray-300">
                          <p className="font-black text-xs uppercase text-gray-900 leading-tight">
                            {settings.companyName || "NAMA USAHA"}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-1 leading-tight">
                            {settings.companyAddress || "Alamat Outlet"}
                          </p>
                          <p className="text-[10px] text-gray-600">
                            WA: {settings.companyPhone || "-"}
                          </p>
                        </div>

                        {/* Meta */}
                        <div className="py-2 border-b border-dashed border-gray-300 space-y-0.5 text-[10px] text-gray-600">
                          <div className="flex justify-between">
                            <span>No: TRX-DEMO01</span>
                            <span>{todayLabel || '08:00'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Kasir: Kasir Shift</span>
                            <span>{selectedBranch}</span>
                          </div>
                        </div>

                        {/* Sample Item */}
                        <div className="py-2 border-b border-dashed border-gray-300 space-y-1">
                          <div>
                            <p className="font-bold text-gray-900">Isi Baru Motor</p>
                            <div className="flex justify-between text-gray-700">
                              <span>1 x Rp 5.000</span>
                              <span>Rp 5.000</span>
                            </div>
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">Ganti Oli Mesin</p>
                            <div className="flex justify-between text-gray-700">
                              <span>1 x Rp 50.000</span>
                              <span>Rp 50.000</span>
                            </div>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="py-2 border-b border-dashed border-gray-300 space-y-1">
                          <div className="flex justify-between font-bold">
                            <span>TOTAL:</span>
                            <span className="font-black text-gray-900">Rp 55.000</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-600">
                            <span>Metode:</span>
                            <span>CASH (Tunai)</span>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center pt-3 text-[10px] text-gray-600 leading-tight">
                          <p className="font-medium">{settings.receiptFooter || "Terima kasih atas kunjungan Anda."}</p>
                          <p className="mt-1 text-[9px] text-gray-400">=== POS AL-KAHFI ===</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
                    >
                      <Save size={18} />
                      <span>Simpan Seluruh Pengaturan</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetSettings}
                      className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl border border-gray-300 transition-all flex items-center justify-center space-x-2 text-xs cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      <span>Reset ke Default Pabrik</span>
                    </button>

                    <p className="text-[11px] text-gray-500 text-center font-medium leading-relaxed">
                      Pengaturan akan otomatis diterapkan pada peramban browser kasir & tablet POS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

            {/* Modal Tambah / Edit Pelanggan CRM */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-gray-200 text-gray-900 overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <h3 className="font-extrabold text-xl text-gray-900">
                {newCustomer.id ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Plat Nomor Kendaraan</label>
                <input 
                  type="text" 
                  value={newCustomer.plat} 
                  onChange={e => setNewCustomer({...newCustomer, plat: e.target.value.toUpperCase()})} 
                  placeholder="Misal: B 1234 ABC" 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-mono font-bold text-gray-900 uppercase bg-white" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Nomor WhatsApp / HP (Opsional)</label>
                <input 
                  type="text" 
                  value={newCustomer.phone} 
                  onChange={e => setNewCustomer({...newCustomer, phone: e.target.value.replace(/\D/g, '')})} 
                  placeholder="Misal: 081234567890" 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Total Poin Loyalti</label>
                  <input 
                    type="number" 
                    value={newCustomer.poin} 
                    onChange={e => setNewCustomer({...newCustomer, poin: parseInt(e.target.value) || 0})} 
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Total Kunjungan</label>
                  <input 
                    type="number" 
                    value={newCustomer.kunjung} 
                    onChange={e => setNewCustomer({...newCustomer, kunjung: parseInt(e.target.value) || 1})} 
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Layanan Favorit</label>
                <input 
                  type="text" 
                  value={newCustomer.fav} 
                  onChange={e => setNewCustomer({...newCustomer, fav: e.target.value})} 
                  placeholder="Misal: Isi Baru Motor" 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Cabang Terdaftar</label>
                <select 
                  value={newCustomer.branch} 
                  onChange={e => setNewCustomer({...newCustomer, branch: e.target.value})} 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white"
                >
                  {branchStats.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 shrink-0 rounded-b-2xl">
              <button 
                onClick={() => setShowCustomerModal(false)} 
                className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg text-sm cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveCustomer} 
                className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow text-sm cursor-pointer"
              >
                Simpan Pelanggan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tukar Poin Loyalti Pelanggan */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-gray-200 text-gray-900 overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <Gift size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-gray-900">Tukar Poin Loyalti</h3>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">
                    Kendaraan: <b className="font-mono text-gray-900">{showRedeemModal.plat}</b> (Poin: <b className="text-blue-600">{showRedeemModal.poin} pts</b>)
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRedeemModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {[
                { name: "Gratis 1x Isi Nitrogen Motor", pts: 30, desc: "Potong 30 Poin" },
                { name: "Diskon Tambal Ban Rp 5.000", pts: 50, desc: "Potong 50 Poin" },
                { name: "Gratis 1x Isi Nitrogen Mobil", pts: 80, desc: "Potong 80 Poin" },
                { name: "Diskon Ganti Oli Rp 15.000", pts: 150, desc: "Potong 150 Poin" }
              ].map((reward, idx) => (
                <div 
                  key={idx} 
                  className={`p-3.5 border-2 rounded-xl flex justify-between items-center transition-all ${showRedeemModal.poin >= reward.pts ? 'border-gray-200 bg-white hover:border-amber-500' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                >
                  <div>
                    <p className="font-bold text-sm text-gray-900">{reward.name}</p>
                    <p className="text-xs font-semibold text-amber-700 mt-0.5">{reward.desc}</p>
                  </div>
                  <button
                    disabled={showRedeemModal.poin < reward.pts}
                    onClick={() => handleRedeemReward(showRedeemModal, reward.pts, reward.name)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    Klaim
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0 rounded-b-2xl">
              <button 
                type="button"
                onClick={() => setShowRedeemModal(null)} 
                className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg text-sm cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-gray-200 text-gray-900 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <h3 className="font-extrabold text-xl text-gray-900">
                {newProduct.id ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button 
                type="button"
                onClick={() => { setShowProductModal(false); setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen', barcode: '' }); }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Nama Produk</label>
                <input type="text" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-gray-800">Kode Barcode / SKU</label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomBarcode = '899' + Math.floor(1000000000 + Math.random() * 9000000000);
                      setNewProduct({ ...newProduct, barcode: randomBarcode });
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    ⚡ Generate Barcode
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={newProduct.barcode || ''}
                    onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                    placeholder="Contoh: 8992761123456 (bisa diketik / scan via barcode scanner)"
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 pl-9 outline-none focus:ring-2 focus:border-blue-500 font-mono font-bold text-gray-900 bg-white"
                  />
                  <ScanLine size={18} className="absolute left-2.5 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Digunakan untuk identifikasi scan produk di menu Kasir maupun Master Data Owner.
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">Kategori Produk</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProduct({...newProduct, category: 'nitrogen'})}
                    className={`p-3 rounded-xl border-2 text-sm transition-all flex items-center justify-center space-x-2 ${newProduct.category === 'nitrogen' ? 'border-blue-600 bg-blue-50 text-blue-900 font-extrabold shadow-sm' : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-400 font-bold'}`}
                  >
                    <span>⚗️</span><span>Layanan Nitrogen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProduct({...newProduct, category: 'ritel'})}
                    className={`p-3 rounded-xl border-2 text-sm transition-all flex items-center justify-center space-x-2 ${newProduct.category === 'ritel' ? 'border-purple-600 bg-purple-50 text-purple-900 font-extrabold shadow-sm' : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-400 font-bold'}`}
                  >
                    <span>🛒</span><span>Ritel & Aksesoris</span>
                  </button>
                </div>

                {newProduct.category === 'nitrogen' && (
                  <div className="mt-3 p-3 bg-blue-50/70 rounded-xl border border-blue-200">
                    <label className="block text-xs font-extrabold text-blue-900 mb-1.5">
                      Tipe Kendaraan di Kasir POS:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const base = newProduct.name.replace(/\s*(Motor|Mobil)\s*$/i, '').trim();
                          setNewProduct({
                            ...newProduct,
                            name: base ? `${base} Motor` : 'Layanan Motor'
                          });
                        }}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          newProduct.name.toLowerCase().includes('motor') || (!newProduct.name.toLowerCase().includes('mobil') && newProduct.category === 'nitrogen')
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span>🏍️</span><span>Khusus Motor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = newProduct.name.replace(/\s*(Motor|Mobil)\s*$/i, '').trim();
                          setNewProduct({
                            ...newProduct,
                            name: base ? `${base} Mobil` : 'Layanan Mobil'
                          });
                        }}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          newProduct.name.toLowerCase().includes('mobil')
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span>🚗</span><span>Khusus Mobil</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-blue-800 font-medium mt-1.5">
                      Produk ini akan tampil di varian {newProduct.name.toLowerCase().includes('mobil') ? 'Mobil' : 'Motor'} pada tab Layanan Nitrogen kasir.
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Harga Jual</label>
                  <input type="number" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" value={newProduct.harga} onChange={e => setNewProduct({...newProduct, harga: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">HPP (Modal)</label>
                  <input type="number" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" value={newProduct.hpp} onChange={e => setNewProduct({...newProduct, hpp: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Stok Fisik</label>
                  <input type="number" className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" value={newProduct.stok} onChange={e => setNewProduct({...newProduct, stok: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Foto Produk</label>
                  <input type="file" accept="image/*" className="w-full text-xs font-bold text-gray-800 border-2 border-gray-300 rounded-lg p-2 bg-gray-50 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" onChange={(e) => {
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
                 <div className="mt-1 text-center">
                    <img src={newProduct.img} alt="Preview" className="w-16 h-16 object-cover mx-auto rounded-lg border border-gray-200" />
                 </div>
              )}
            </div>

            {/* Modal Footer (Pinned at bottom, always fully visible) */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl">
              {newProduct.id ? (
                <button 
                  type="button"
                  onClick={async () => {
                    if (!confirm('Hapus produk ini? Tindakan tidak dapat dibatalkan.')) return;
                    try {
                      await supabase.from('products').delete().eq('id', newProduct.id);
                      const updated = products.filter(p => p.id !== newProduct.id);
                      setProducts(updated);
                      saveProducts(updated);
                      setShowProductModal(false);
                      setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen', barcode: '' });
                      alert('Produk berhasil dihapus!');
                    } catch (err: any) {
                      alert('Gagal menghapus: ' + (err?.message || 'Error'));
                    }
                  }} 
                  className="px-4 py-2 font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-sm cursor-pointer"
                >
                  🗑 Hapus
                </button>
              ) : <div></div>}
              <div className="flex space-x-3 ml-auto">
                <button 
                  type="button"
                  onClick={() => { setShowProductModal(false); setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen', barcode: '' }); }} 
                  className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    if (!newProduct.name.trim()) { alert('Nama produk tidak boleh kosong!'); return; }
                    try {
                      let updated: any[];
                      const productPayload: any = {
                        name: newProduct.name,
                        harga: newProduct.harga,
                        hpp: newProduct.hpp,
                        stok: newProduct.stok,
                        img: newProduct.img,
                        category: newProduct.category,
                        updated_at: new Date().toISOString()
                      };
                      if (newProduct.barcode) {
                        productPayload.barcode = newProduct.barcode;
                      }

                      if (newProduct.id) {
                        // Update di Supabase
                        let { error } = await supabase.from('products').update(productPayload).eq('id', newProduct.id);
                        if (error && error.message?.toLowerCase().includes('barcode')) {
                          delete productPayload.barcode;
                          const retry = await supabase.from('products').update(productPayload).eq('id', newProduct.id);
                          if (retry.error) throw retry.error;
                        } else if (error) {
                          throw error;
                        }
                        updated = products.map(p => p.id === newProduct.id ? { ...newProduct } : p);
                        alert('Produk berhasil diperbarui!');
                      } else {
                        // Insert ke Supabase
                        let { data: inserted, error } = await supabase.from('products').insert(productPayload).select().single();
                        if (error && error.message?.toLowerCase().includes('barcode')) {
                          delete productPayload.barcode;
                          const retry = await supabase.from('products').insert(productPayload).select().single();
                          if (retry.error) throw retry.error;
                          inserted = retry.data;
                        } else if (error) {
                          throw error;
                        }
                        updated = [...products, { ...inserted, barcode: newProduct.barcode }];
                        alert('Produk berhasil ditambahkan!');
                      }
                      setProducts(updated);
                      saveProducts(updated);
                      // Broadcast ke kasir agar update real-time
                      const bc = new BroadcastChannel('pos_demo_channel');
                      bc.postMessage({ type: 'DB_UPDATE', payload: { entity: 'products' } });
                      bc.close();
                      setShowProductModal(false);
                      setNewProduct({ name: '', harga: 0, hpp: 0, stok: 0, img: '', category: 'nitrogen', barcode: '' });
                    } catch (err: any) {
                      alert('Gagal menyimpan produk: ' + (err?.message || 'Error koneksi Supabase'));
                    }
                  }} 
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm text-sm cursor-pointer"
                >
                  Simpan Produk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Add / Edit Operator / SPV Modal */}
      {showOperatorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-gray-200 text-gray-900 overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="font-extrabold text-xl text-gray-900">{newOperator.id ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</h3>
                <p className="text-xs text-gray-700 font-medium mt-0.5">Atur hak akses kasir / supervisor dan komisi dasar</p>
              </div>
              <button 
                type="button"
                onClick={() => { setShowOperatorModal(false); setNewOperator({ name: '', pin: '', branch: '', role: 'Operator', baseCommissionRate: 5 }); }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white" 
                  value={newOperator.name} 
                  onChange={e => setNewOperator({...newOperator, name: e.target.value})} 
                  placeholder="Misal: Budi Santoso" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Jabatan / Peran</label>
                  <select 
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm" 
                    value={newOperator.role || 'Operator'} 
                    onChange={e => {
                      const newRole = e.target.value;
                      const defaultRate = newRole === 'Supervisor' ? 3 : 5;
                      setNewOperator({
                        ...newOperator, 
                        role: newRole,
                        baseCommissionRate: newOperator.baseCommissionRate !== undefined ? newOperator.baseCommissionRate : defaultRate
                      });
                    }}
                  >
                    <option value="Operator">Operator (Kasir)</option>
                    <option value="Supervisor">Supervisor (SPV)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">Komisi Dasar (%)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm" 
                    value={newOperator.baseCommissionRate !== undefined ? newOperator.baseCommissionRate : (newOperator.role === 'Supervisor' ? 3 : 5)} 
                    onChange={e => setNewOperator({...newOperator, baseCommissionRate: Number(e.target.value)})} 
                    placeholder="Misal: 5" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">PIN Akses (4-6 digit)</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-mono font-bold text-gray-900 bg-white" 
                  value={newOperator.pin} 
                  onChange={e => setNewOperator({...newOperator, pin: e.target.value.replace(/\D/g, '')})} 
                  placeholder="1234" 
                  maxLength={6} 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Cabang Penempatan</label>
                <select 
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm" 
                  value={newOperator.branch} 
                  onChange={e => setNewOperator({...newOperator, branch: e.target.value})}
                >
                  {branchStats.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3 shrink-0 rounded-b-2xl">
              <button 
                type="button" 
                onClick={() => { setShowOperatorModal(false); setNewOperator({ name: '', pin: '', branch: '', role: 'Operator', baseCommissionRate: 5 }); }} 
                className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg text-sm cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (!newOperator.name || !newOperator.pin || !newOperator.branch) {
                    alert("Harap lengkapi nama, PIN, dan cabang karyawan!");
                    return;
                  }
                  const role = newOperator.role || 'Operator';
                  const baseRate = newOperator.baseCommissionRate !== undefined ? newOperator.baseCommissionRate : (role === 'Supervisor' ? 3 : 5);
                  const payload = {
                    ...newOperator,
                    role,
                    baseCommissionRate: baseRate
                  };

                  let newOps;
                  if (newOperator.id) {
                    newOps = operators.map(o => o.id === newOperator.id ? { ...payload } : o);
                    alert(`Data karyawan ${newOperator.name} berhasil diperbarui!`);
                  } else {
                    newOps = [...operators, { ...payload, id: Date.now() }];
                    alert(`Karyawan ${newOperator.name} berhasil ditambahkan!`);
                  }
                  setOperators(newOps);
                  saveOperators(newOps);
                  setShowOperatorModal(false);
                  setNewOperator({ name: '', pin: '', branch: '', role: 'Operator', baseCommissionRate: 5 });
                }} 
                className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow text-sm cursor-pointer"
              >
                Simpan Karyawan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN TARGET & SKEMA KPI OTOMATIS */}
      {showKpiSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col border border-gray-200 text-gray-900 overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-900 to-blue-950 text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-yellow-400 text-slate-950 rounded-lg">
                  <Target size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">Konfigurasi Target Cabang & Skema KPI</h3>
                  <p className="text-xs text-blue-200 font-medium">Atur target omzet harian/bulanan dan rumus komisi (+/- 25%)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowKpiSettingsModal(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* TARGET UTAMA CABANG */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" />
                  1. Target Omzet Cabang & Ambang Batas Evaluasi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Target Bulanan Cabang (Rp)</label>
                    <input 
                      type="number"
                      step="500000"
                      min="1000000"
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm"
                      value={editingKpiSettings.monthlyTarget}
                      onChange={e => {
                        const mTarget = Number(e.target.value);
                        setEditingKpiSettings({
                          ...editingKpiSettings,
                          monthlyTarget: mTarget,
                          dailyTarget: Math.round(mTarget / 30)
                        });
                      }}
                      placeholder="15000000"
                    />
                    <p className="text-[11px] text-gray-600 font-medium mt-1">Standar: Rp 15.000.000 / bulan</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Target Harian Cabang (Rp)</label>
                    <input 
                      type="number"
                      step="50000"
                      min="10000"
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm"
                      value={editingKpiSettings.dailyTarget}
                      onChange={e => setEditingKpiSettings({ ...editingKpiSettings, dailyTarget: Number(e.target.value) })}
                      placeholder="500000"
                    />
                    <p className="text-[11px] text-gray-600 font-medium mt-1">Standar: Rp 500.000 / hari</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ambang Batas Evaluasi Harian (Benchmark Rp)</label>
                    <input 
                      type="number"
                      step="50000"
                      min="10000"
                      className="w-full border-2 border-amber-300 bg-amber-50/30 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-amber-500 font-black text-gray-900 text-sm"
                      value={editingKpiSettings.thresholdDaily}
                      onChange={e => setEditingKpiSettings({ ...editingKpiSettings, thresholdDaily: Number(e.target.value) })}
                      placeholder="250000"
                    />
                    <p className="text-[11px] text-amber-800 font-semibold mt-1">
                      Ambang batas pembeda: jika rata-rata omset &ge; Rp {editingKpiSettings.thresholdDaily.toLocaleString('id-ID')} mendapat bonus 25%, jika di bawah mendapat potongan 25%.
                    </p>
                  </div>
                </div>
              </div>

              {/* RUMUS POTONGAN & TAMBAHAN KOMISI */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                  <Percent size={14} className="text-emerald-600" />
                  2. Persentase Penyesuaian Kinerja (Total: {editingKpiSettings.operatorAdjustmentRate + editingKpiSettings.supervisorAdjustmentRate}%)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Penyesuaian Operator / Kasir (%)</label>
                    <input 
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm"
                      value={editingKpiSettings.operatorAdjustmentRate}
                      onChange={e => setEditingKpiSettings({ ...editingKpiSettings, operatorAdjustmentRate: Number(e.target.value) })}
                      placeholder="15"
                    />
                    <p className="text-[11px] text-gray-600 font-medium mt-1">Standar aturan: 15% untuk operator</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Penyesuaian Supervisor / SPV (%)</label>
                    <input 
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm"
                      value={editingKpiSettings.supervisorAdjustmentRate}
                      onChange={e => setEditingKpiSettings({ ...editingKpiSettings, supervisorAdjustmentRate: Number(e.target.value) })}
                      placeholder="10"
                    />
                    <p className="text-[11px] text-gray-600 font-medium mt-1">Standar aturan: 10% untuk SPV</p>
                  </div>
                </div>
              </div>

              {/* KOMISI DASAR STANDAR */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                  <DollarSign size={14} className="text-indigo-600" />
                  3. Komisi Dasar Standar (% dari Omzet Cabang)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Komisi Dasar Operator (%)</label>
                    <input 
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm"
                      value={editingKpiSettings.operatorBaseRate}
                      onChange={e => setEditingKpiSettings({ ...editingKpiSettings, operatorBaseRate: Number(e.target.value) })}
                      placeholder="5"
                    />
                    <p className="text-[11px] text-gray-600 font-medium mt-1">Komisi pokok sebelum bonus/potongan (Default: 5%)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Komisi Dasar Supervisor (%)</label>
                    <input 
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-gray-900 bg-white text-sm"
                      value={editingKpiSettings.supervisorBaseRate}
                      onChange={e => setEditingKpiSettings({ ...editingKpiSettings, supervisorBaseRate: Number(e.target.value) })}
                      placeholder="3"
                    />
                    <p className="text-[11px] text-gray-600 font-medium mt-1">Komisi pokok sebelum bonus/potongan (Default: 3%)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  setEditingKpiSettings({ ...DEFAULT_KPI_SETTINGS });
                }}
                className="px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title="Kembalikan ke nilai default awal (15jt, 500rb, 250rb, 15% & 10%)"
              >
                <RotateCcw size={13} />
                <span>Reset ke Standar</span>
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowKpiSettingsModal(false)}
                  className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKpiSettings({ ...editingKpiSettings });
                    saveKpiSettings(editingKpiSettings);
                    setShowKpiSettingsModal(false);
                    alert("✅ Konfigurasi target cabang dan skema KPI berhasil disimpan!");
                  }}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow text-sm cursor-pointer"
                >
                  Simpan Konfigurasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSnapshot(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 right-0 flex space-x-2">
              <button 
                onClick={async () => {
                  if (!confirm("Hapus foto CCTV ini dari sistem?")) return;
                  const matchingTrx = rawTransactions.find(t => t.snapshot_url === selectedSnapshot);
                  if (matchingTrx) {
                    await supabase.from('transactions').update({ snapshot_url: null }).eq('id', matchingTrx.id);
                    setRawTransactions(prev => prev.map(t => t.id === matchingTrx.id ? { ...t, snapshot_url: null } : t));
                  }
                  setSnapshots(prev => prev.filter(s => (s.img || s.url) !== selectedSnapshot));
                  setSelectedSnapshot(null);
                  alert("✅ Gambar berhasil dihapus!");
                }}
                className="text-red-300 hover:text-red-100 font-bold text-sm bg-red-950/70 border border-red-800/80 px-4 py-2 rounded-lg backdrop-blur-md flex items-center space-x-1.5"
              >
                <Trash2 size={14} />
                <span>Hapus Gambar</span>
              </button>
              <button onClick={() => setSelectedSnapshot(null)} className="text-white hover:text-gray-300 font-bold text-sm bg-white/10 px-4 py-2 rounded-lg backdrop-blur-md">
                Tutup (Esc)
              </button>
            </div>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setSelectedFraudModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-red-100 my-auto animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-5 flex justify-between items-start border-b border-gray-100 shrink-0 bg-white">
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
              <button 
                type="button"
                onClick={() => setSelectedFraudModal(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <div>
                  <p className="text-gray-700 font-bold text-xs uppercase tracking-wide">Cabang Lokasi</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{selectedFraudModal.branch}</p>
                </div>
                <div>
                  <p className="text-gray-700 font-bold text-xs uppercase tracking-wide">Waktu Deteksi</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{selectedFraudModal.time} WIB</p>
                </div>
                <div>
                  <p className="text-gray-700 font-bold text-xs uppercase tracking-wide">Kasir Bertugas</p>
                  <p className="font-bold text-gray-800 mt-0.5">{selectedFraudModal.cashier || 'Kasir'}</p>
                </div>
                <div>
                  <p className="text-gray-700 font-bold text-xs uppercase tracking-wide">Status Notifikasi</p>
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
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-xs font-bold text-gray-700 flex items-center">
                      <Camera size={14} className="mr-1 text-blue-600" /> Bukti Foto CCTV Terkait:
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Hapus gambar bukti dari log fraud ini?")) return;
                        try {
                          const targetId = selectedFraudModal.id;
                          if (targetId && !String(targetId).startsWith('fraud-')) {
                            await supabase.from('transactions').update({ snapshot_url: null }).eq('id', targetId);
                          }
                          setRawTransactions(prev => prev.map(t => t.id === targetId ? { ...t, snapshot_url: null } : t));
                          setFraudLogs(prev => prev.map(f => f.id === targetId ? { ...f, snapshotUrl: null } : f));
                          setSelectedFraudModal((prev: any) => prev ? { ...prev, snapshotUrl: null } : null);
                          alert("✅ Gambar bukti fraud berhasil dihapus!");
                        } catch (err: any) {
                          alert("Gagal menghapus gambar: " + (err?.message || "Error"));
                        }
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Hapus Gambar Bukti</span>
                    </button>
                  </div>
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

            <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 rounded-b-2xl flex flex-col sm:flex-row justify-end gap-2">
              <button 
                type="button"
                onClick={() => {
                  alert(`🚨 Notifikasi Ulang Berhasil Terkirim!\n\nPesan darurat telah dikirim kembali ke Telegram Bot @AlKahfiAlertBot untuk cabang ${selectedFraudModal.branch}.`);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Send size={13} />
                <span>Kirim Ulang ke Telegram</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  setSelectedFraudModal(null);
                  setActiveTab("audit");
                }} 
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Camera size={13} />
                <span>Investigasi di Audit CCTV</span>
              </button>
              <button 
                type="button"
                onClick={() => setSelectedFraudModal(null)} 
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Configuration Modal */}
      {selectedBranchConfig && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden my-auto">
            <div className="p-4 sm:p-5 flex justify-between items-center border-b border-gray-100 shrink-0 bg-white">
              <div>
                <h3 className="font-extrabold text-lg text-gray-900">Konfigurasi Node IoT: {selectedBranchConfig.name}</h3>
                <p className="text-xs text-gray-700 font-bold">Sinkronisasi Hardware ESP32 & Solenoid Valve</p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedBranchConfig(null)} 
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs font-bold text-blue-800 mb-1">Status Sinkronisasi ESP32 (System A - Time Starvation)</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  ESP32 terhubung langsung ke Cloud Supabase (tabel <b>branch_devices</b>). Saat kasir memproses pengerjaan, status berubah ke <b>ACTIVE</b> dan ESP32 akan membuka solenoid valve pada GPIO 4 secara otomatis.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nama Cabang</label>
                  <input type="text" value={selectedBranchConfig.name} onChange={(e) => setSelectedBranchConfig({...selectedBranchConfig, name: e.target.value})} className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-bold text-sm text-gray-900 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Device Code (ESP32 Node ID)</label>
                  <input type="text" value={selectedBranchConfig.deviceCode || 'NITRO-01'} onChange={(e) => setSelectedBranchConfig({...selectedBranchConfig, deviceCode: e.target.value})} className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:border-blue-500 font-mono font-bold text-sm text-blue-800 bg-white" />
                </div>
              </div>

              {/* Status Hardware Real-time Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-800 font-bold">Status Real Perangkat:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${selectedBranchConfig.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    ● {selectedBranchConfig.status || 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-800 font-bold">Device Relay State:</span>
                  <span className="font-mono font-bold text-gray-800">{selectedBranchConfig.deviceStatus || 'IDLE'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-bold">Heartbeat Terakhir:</span>
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
                  <p className="text-xs text-gray-700 font-medium">Nonaktifkan untuk perawatan berkala</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={selectedBranchConfig.status === 'Online'} onChange={(e) => setSelectedBranchConfig({...selectedBranchConfig, status: e.target.checked ? 'Online' : 'Offline'})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0 rounded-b-2xl">
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
                className="w-full sm:w-auto px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>⚡ Test Buka Valve (5s)</span>
              </button>

              <div className="flex space-x-2 w-full sm:w-auto justify-end">
                <button 
                  type="button"
                  onClick={() => setSelectedBranchConfig(null)} 
                  className="px-4 py-2 font-bold text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg text-sm cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="button"
                  onClick={async () => {
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
                  }} 
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow text-sm cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
