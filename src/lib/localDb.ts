import { supabase } from "./supabase";

export const DEFAULT_OPERATORS = [
  { id: 1, name: "Baim", pin: "1234", branch: "Graha Prima", role: "Operator", baseCommissionRate: 5 }
];

export const DEFAULT_PRODUCTS = [
  // Layanan Nitrogen Motor
  { id: 1, name: "Isi Baru Motor", harga: 5000, hpp: 500, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Isi+Baru", category: "nitrogen", barcode: "NITRO-MTR-01" },
  { id: 2, name: "Tambah Angin Motor", harga: 2000, hpp: 200, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambah", category: "nitrogen", barcode: "NITRO-MTR-02" },
  { id: 3, name: "Tambal Ban Motor", harga: 15000, hpp: 1000, stok: 4, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambal", category: "nitrogen", barcode: "NITRO-MTR-03" },
  
  // Layanan Nitrogen Mobil
  { id: 4, name: "Isi Baru Mobil", harga: 10000, hpp: 1000, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Isi+Mobil", category: "nitrogen", barcode: "NITRO-MBL-01" },
  { id: 5, name: "Tambah Angin Mobil", harga: 5000, hpp: 500, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambah+Mobil", category: "nitrogen", barcode: "NITRO-MBL-02" },
  { id: 6, name: "Tambal Ban Mobil", harga: 25000, hpp: 2000, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambal+Mobil", category: "nitrogen", barcode: "NITRO-MBL-03" },

  // Ritel & Aksesoris
  { id: 7, name: "Ganti Oli Mesin", harga: 50000, hpp: 35000, stok: 12, img: "https://placehold.co/100x100/1e293b/ffffff?text=Oli", category: "ritel", barcode: "8992761123456" },
  { id: 8, name: "Cairan Tubles", harga: 35000, hpp: 20000, stok: 2, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tubles", category: "ritel", barcode: "8992761654321" },
];

export function getOperators() {
  if (typeof window === "undefined") return DEFAULT_OPERATORS;
  const data = localStorage.getItem("pos_operators");
  if (!data) return DEFAULT_OPERATORS;
  try {
    const list = JSON.parse(data);
    return list.map((op: any) => {
      const isSpv = op.role === 'Supervisor' || (op.name && (op.name.toLowerCase().includes('spv') || op.name.toLowerCase().includes('supervisor')));
      return {
        ...op,
        role: op.role || (isSpv ? 'Supervisor' : 'Operator'),
        baseCommissionRate: op.baseCommissionRate !== undefined ? Number(op.baseCommissionRate) : (isSpv ? 3 : 5)
      };
    });
  } catch {
    return DEFAULT_OPERATORS;
  }
}

export function saveOperators(operators: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_operators", JSON.stringify(operators));
  // Broadcast update
  try {
    const channel = new BroadcastChannel('pos_demo_channel');
    channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'operators' } });
    channel.close();
  } catch {}

  // Sync ke Supabase agar semua tablet/browser kasir mendapatkan data terbaru secara instan
  (async () => {
    try {
      await supabase.from('transactions').insert({
        total_amount: 0,
        payment_status: 'SYSTEM_CONFIG_OPERATORS',
        payment_method: 'OPERATORS',
        snapshot_url: JSON.stringify(operators),
        branch_id: 'SYSTEM'
      });
    } catch (err) {
      console.error("Cloud sync operators failed:", err);
    }
  })();
}

export function getProducts() {
  if (typeof window === "undefined") return DEFAULT_PRODUCTS;
  const data = localStorage.getItem("pos_products");
  if (!data) return DEFAULT_PRODUCTS;
  try {
    const parsed = JSON.parse(data);
    return parsed.map((p: any) => {
      if (!p.barcode) {
        const def = DEFAULT_PRODUCTS.find(dp => dp.id === p.id || dp.name === p.name);
        if (def?.barcode) return { ...p, barcode: def.barcode };
      }
      return p;
    });
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

export function saveProducts(products: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_products", JSON.stringify(products));
  // Broadcast update
  const channel = new BroadcastChannel('pos_demo_channel');
  channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'products' } });
  channel.close();
}

export const DEFAULT_BRANCHES = [
  { name: "Graha Prima", status: "Online", omzet: 0, trx: 0 },
  { name: "Regency", status: "Online", omzet: 0, trx: 0 },
  { name: "Graha Melasty", status: "Online", omzet: 0, trx: 0 },
  { name: "Buwek", status: "Online", omzet: 0, trx: 0 },
];

export function getBranches() {
  if (typeof window === "undefined") return DEFAULT_BRANCHES;
  const data = localStorage.getItem("pos_branches");
  return data ? JSON.parse(data) : DEFAULT_BRANCHES;
}

export function saveBranches(branches: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_branches", JSON.stringify(branches));
  // Broadcast update
  try {
    const channel = new BroadcastChannel('pos_demo_channel');
    channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'branchStats', data: branches } });
    channel.close();
  } catch {}

  // Sync ke Supabase agar semua tablet/browser kasir mendapatkan data cabang terbaru secara instan
  (async () => {
    try {
      await supabase.from('transactions').insert({
        total_amount: 0,
        payment_status: 'SYSTEM_CONFIG_BRANCHES',
        payment_method: 'BRANCHES',
        snapshot_url: JSON.stringify(branches),
        branch_id: 'SYSTEM'
      });
    } catch (err) {
      console.error("Cloud sync branches failed:", err);
    }
  })();
}

export const DEFAULT_CUSTOMERS = [
  { id: 1, plat: "B 1234 ABC", phone: "081234567890", kunjung: 12, last: "Hari Ini, 09:30", fav: "Isi Baru Motor", poin: 120, branch: "Tambun 1" },
  { id: 2, plat: "B 4321 XYZ", phone: "081987654321", kunjung: 8, last: "Kemarin, 14:15", fav: "Ganti Oli Mesin", poin: 80, branch: "Tambun 1" },
  { id: 3, plat: "B 9999 KKK", phone: "085712345678", kunjung: 3, last: "05 Okt 2026", fav: "Tambal Ban Motor", poin: 30, branch: "Tambun 2" },
  { id: 4, plat: "D 5678 EFG", phone: "087812345678", kunjung: 25, last: "01 Okt 2026", fav: "Isi Tambah Mobil", poin: 250, branch: "Tambun 1" },
];

export function getCustomers() {
  if (typeof window === "undefined") return DEFAULT_CUSTOMERS;
  const data = localStorage.getItem("pos_customers");
  return data ? JSON.parse(data) : DEFAULT_CUSTOMERS;
}

export function saveCustomers(customers: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_customers", JSON.stringify(customers));
  // Broadcast update
  const channel = new BroadcastChannel('pos_demo_channel');
  channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'customers' } });
  channel.close();
}

export interface BranchTargetConfig {
  monthlyTarget: number;
  dailyTarget: number;
  thresholdDaily: number;
}

export interface KPISettings {
  monthlyTarget: number;           // Target Omset Bulanan per cabang, default 15.000.000 (15 Juta)
  dailyTarget: number;             // Target Omset Harian, default 500.000 (500 Ribu/hari)
  thresholdDaily: number;          // Ambang Batas Evaluasi Harian, default 250.000 (250 Ribu/hari)
  operatorAdjustmentRate: number;  // Potongan / Tambahan Komisi Operator, default 15 (%)
  supervisorAdjustmentRate: number;// Potongan / Tambahan Komisi Supervisor, default 10 (%)
  operatorBaseRate: number;        // Komisi Dasar Standar Operator, default 5 (%)
  supervisorBaseRate: number;      // Komisi Dasar Standar Supervisor, default 3 (%)
  branchTargets?: { [branchName: string]: BranchTargetConfig };
}

export const DEFAULT_KPI_SETTINGS: KPISettings = {
  monthlyTarget: 15000000,
  dailyTarget: 500000,
  thresholdDaily: 250000,
  operatorAdjustmentRate: 15,
  supervisorAdjustmentRate: 10,
  operatorBaseRate: 5,
  supervisorBaseRate: 3,
  branchTargets: {
    "Tambun 1": { monthlyTarget: 15000000, dailyTarget: 500000, thresholdDaily: 250000 },
    "Tambun 2": { monthlyTarget: 15000000, dailyTarget: 500000, thresholdDaily: 250000 },
    "Cibitung 1": { monthlyTarget: 15000000, dailyTarget: 500000, thresholdDaily: 250000 },
    "Cibitung 2": { monthlyTarget: 15000000, dailyTarget: 500000, thresholdDaily: 250000 },
  }
};

export function getKpiSettings(): KPISettings {
  if (typeof window === "undefined") return DEFAULT_KPI_SETTINGS;
  const data = localStorage.getItem("pos_kpi_settings");
  if (!data) return DEFAULT_KPI_SETTINGS;
  try {
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_KPI_SETTINGS,
      ...parsed,
      branchTargets: {
        ...DEFAULT_KPI_SETTINGS.branchTargets,
        ...(parsed.branchTargets || {})
      }
    };
  } catch {
    return DEFAULT_KPI_SETTINGS;
  }
}

export function saveKpiSettings(settings: KPISettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_kpi_settings", JSON.stringify(settings));
  // Broadcast update
  const channel = new BroadcastChannel('pos_demo_channel');
  channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'kpiSettings', data: settings } });
  channel.close();
}

