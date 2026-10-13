export const DEFAULT_OPERATORS = [
  { id: 1, name: "Budi Santoso", pin: "1234", branch: "Tambun 1" },
  { id: 2, name: "Siti Aminah", pin: "5678", branch: "Tambun 1" }
];

export const DEFAULT_PRODUCTS = [
  // Layanan Nitrogen Motor
  { id: 1, name: "Isi Baru Motor", harga: 5000, hpp: 500, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Isi+Baru", category: "nitrogen" },
  { id: 2, name: "Tambah Angin Motor", harga: 2000, hpp: 200, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambah", category: "nitrogen" },
  { id: 3, name: "Tambal Ban Motor", harga: 15000, hpp: 1000, stok: 4, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambal", category: "nitrogen" },
  
  // Layanan Nitrogen Mobil
  { id: 4, name: "Isi Baru Mobil", harga: 10000, hpp: 1000, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Isi+Mobil", category: "nitrogen" },
  { id: 5, name: "Tambah Angin Mobil", harga: 5000, hpp: 500, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambah+Mobil", category: "nitrogen" },
  { id: 6, name: "Tambal Ban Mobil", harga: 25000, hpp: 2000, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambal+Mobil", category: "nitrogen" },

  // Ritel & Aksesoris
  { id: 7, name: "Ganti Oli Mesin", harga: 50000, hpp: 35000, stok: 12, img: "https://placehold.co/100x100/1e293b/ffffff?text=Oli", category: "ritel" },
  { id: 8, name: "Cairan Tubles", harga: 35000, hpp: 20000, stok: 2, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tubles", category: "ritel" },
];

export function getOperators() {
  if (typeof window === "undefined") return DEFAULT_OPERATORS;
  const data = localStorage.getItem("pos_operators");
  return data ? JSON.parse(data) : DEFAULT_OPERATORS;
}

export function saveOperators(operators: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pos_operators", JSON.stringify(operators));
  // Broadcast update
  const channel = new BroadcastChannel('pos_demo_channel');
  channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'operators' } });
  channel.close();
}

export function getProducts() {
  if (typeof window === "undefined") return DEFAULT_PRODUCTS;
  const data = localStorage.getItem("pos_products");
  return data ? JSON.parse(data) : DEFAULT_PRODUCTS;
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
  { name: "Tambun 1", status: "Online", omzet: 0, trx: 0 },
  { name: "Tambun 2", status: "Online", omzet: 0, trx: 0 },
  { name: "Cibitung 1", status: "Offline", omzet: 0, trx: 0 },
  { name: "Cibitung 2", status: "Online", omzet: 0, trx: 0 },
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
  const channel = new BroadcastChannel('pos_demo_channel');
  channel.postMessage({ type: 'DB_UPDATE', payload: { entity: 'branchStats', data: branches } });
  channel.close();
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
