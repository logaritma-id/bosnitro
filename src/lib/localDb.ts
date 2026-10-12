export const DEFAULT_OPERATORS = [
  { id: 1, name: "Budi Santoso", pin: "1234", branch: "Tambun 1" },
  { id: 2, name: "Siti Aminah", pin: "5678", branch: "Tambun 1" }
];

export const DEFAULT_PRODUCTS = [
  { id: 1, name: "Isi Baru Motor", harga: 5000, hpp: 500, stok: 999, img: "https://placehold.co/100x100/1e293b/ffffff?text=Isi+Baru" },
  { id: 2, name: "Tambal Ban Motor", harga: 15000, hpp: 1000, stok: 4, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tambal" },
  { id: 3, name: "Ganti Oli Mesin", harga: 50000, hpp: 35000, stok: 12, img: "https://placehold.co/100x100/1e293b/ffffff?text=Oli" },
  { id: 4, name: "Cairan Tubles", harga: 35000, hpp: 20000, stok: 2, img: "https://placehold.co/100x100/1e293b/ffffff?text=Tubles" },
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
