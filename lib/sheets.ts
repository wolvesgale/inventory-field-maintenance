// lib/sheets.ts
import { google } from "googleapis";

export type AppUser = {
  id: string;
  loginId: string;
  passwordHash: string;
  role: "worker" | "manager" | "admin" | string;
  name: string;
  area?: string;
  active: boolean;
};

export type InventoryItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  standardQuantity: number;
  minQuantity: number;
  location: string;
};

export type Transaction = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: "add" | "remove" | "adjustment";
  quantity: number;
  reason: string;
  workerId: string;
  workerName: string;
  area: string;
  timestamp: string;
  status: "draft" | "pending" | "approved" | "locked";
  approvedBy?: string;
  approvalTime?: string;
};

export type PhysicalCount = {
  id: string;
  countDate: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  countedQuantity: number;
  systemQuantity: number;
  difference: number;
  workerId: string;
  workerName: string;
  area: string;
  status: "draft" | "confirmed";
};

export type DiffLog = {
  id: string;
  physicalCountId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  difference: number;
  reportedDate: string;
  status: "pending" | "approved" | "locked";
};

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Google Sheets の環境変数が不足しています");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, spreadsheetId };
}

/**
 * login_id から 1件だけユーザーを取得
 */
export async function getUserByLoginId(loginId: string): Promise<AppUser | null> {
  const { sheets, spreadsheetId } = getSheetsClient();

  const range = "Users!A1:G1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) {
    console.log('[DEBUG sheets] No rows found in Users sheet');
    return null;
  }

  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log('[DEBUG sheets] Header:', header);

  const colIndex = (name: string) => header.indexOf(name);

  const idxId = colIndex("id");
  const idxLoginId = colIndex("login_id");
  const idxPassword = colIndex("password_hash");
  const idxRole = colIndex("role");
  const idxName = colIndex("name");
  const idxArea = colIndex("area");
  const idxActive = colIndex("active");

  if (
    idxId === -1 ||
    idxLoginId === -1 ||
    idxPassword === -1 ||
    idxRole === -1 ||
    idxName === -1 ||
    idxActive === -1
  ) {
    console.error('[DEBUG sheets] Column index error:', {
      idxId,
      idxLoginId,
      idxPassword,
      idxRole,
      idxName,
      idxArea,
      idxActive,
    });
    throw new Error("Users シートのヘッダが想定と異なります");
  }

  const row = dataRows.find((r) => r[idxLoginId] === loginId);
  console.log('[DEBUG sheets] Looking for loginId:', loginId);
  console.log('[DEBUG sheets] Found row:', row ? { ...row } : null);

  if (!row) {
    console.log('[DEBUG sheets] No matching row found');
    return null;
  }

  const activeRaw = row[idxActive];
  const isActive =
    String(activeRaw).toLowerCase() === "true" ||
    String(activeRaw) === "1" ||
    String(activeRaw) === "TRUE";

  console.log('[DEBUG sheets] Active check:', { activeRaw, isActive });

  if (!isActive) {
    console.log('[DEBUG sheets] User is not active');
    return null;
  }

  const user: AppUser = {
    id: String(row[idxId]),
    loginId: String(row[idxLoginId]),
    passwordHash: String(row[idxPassword] ?? ""),
    role: String(row[idxRole] ?? "worker"),
    name: String(row[idxName] ?? ""),
    area: idxArea >= 0 ? String(row[idxArea] ?? "") : undefined,
    active: isActive,
  };

  console.log('[DEBUG sheets] Returning user:', { ...user, passwordHash: '***' });
  return user;
}

/**
 * 全商品を取得
 */
export async function getItems(): Promise<InventoryItem[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Items!A1:H1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const items = rows.slice(1).map((row) => ({
    id: String(row[colIndex("id")] || ""),
    code: String(row[colIndex("code")] || ""),
    name: String(row[colIndex("name")] || ""),
    category: String(row[colIndex("category")] || ""),
    unit: String(row[colIndex("unit")] || ""),
    standardQuantity: Number(row[colIndex("standard_quantity")] || 0),
    minQuantity: Number(row[colIndex("min_quantity")] || 0),
    location: String(row[colIndex("location")] || ""),
  }));

  return items;
}

/**
 * 全トランザクションを取得
 */
export async function getTransactions(): Promise<Transaction[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:N1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const transactions = rows.slice(1).map((row) => ({
    id: String(row[colIndex("id")] || ""),
    itemId: String(row[colIndex("item_id")] || ""),
    itemCode: String(row[colIndex("item_code")] || ""),
    itemName: String(row[colIndex("item_name")] || ""),
    type: (row[colIndex("type")] as "add" | "remove" | "adjustment") || "add",
    quantity: Number(row[colIndex("quantity")] || 0),
    reason: String(row[colIndex("reason")] || ""),
    workerId: String(row[colIndex("worker_id")] || ""),
    workerName: String(row[colIndex("worker_name")] || ""),
    area: String(row[colIndex("area")] || ""),
    timestamp: String(row[colIndex("timestamp")] || ""),
    status: (row[colIndex("status")] as "draft" | "pending" | "approved" | "locked") || "draft",
    approvedBy: row[colIndex("approved_by")] ? String(row[colIndex("approved_by")]) : undefined,
    approvalTime: row[colIndex("approval_time")] ? String(row[colIndex("approval_time")]) : undefined,
  }));

  return transactions;
}

/**
 * 新規トランザクションを追加
 */
export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1";

  const id = `TRX_${Date.now()}`;
  const values = [[
    id,
    transaction.itemId,
    transaction.itemCode,
    transaction.itemName,
    transaction.type,
    transaction.quantity,
    transaction.reason,
    transaction.workerId,
    transaction.workerName,
    transaction.area,
    transaction.timestamp,
    transaction.status,
    transaction.approvedBy || "",
    transaction.approvalTime || "",
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}

/**
 * 全棚卸データを取得
 */
export async function getPhysicalCounts(): Promise<PhysicalCount[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "PhysicalCount!A1:J1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const counts = rows.slice(1).map((row) => ({
    id: String(row[colIndex("id")] || ""),
    countDate: String(row[colIndex("count_date")] || ""),
    itemId: String(row[colIndex("item_id")] || ""),
    itemCode: String(row[colIndex("item_code")] || ""),
    itemName: String(row[colIndex("item_name")] || ""),
    countedQuantity: Number(row[colIndex("counted_quantity")] || 0),
    systemQuantity: Number(row[colIndex("system_quantity")] || 0),
    difference: Number(row[colIndex("difference")] || 0),
    workerId: String(row[colIndex("worker_id")] || ""),
    workerName: String(row[colIndex("worker_name")] || ""),
    area: String(row[colIndex("area")] || ""),
    status: (row[colIndex("status")] as "draft" | "confirmed") || "draft",
  }));

  return counts;
}

/**
 * 新規棚卸データを追加
 */
export async function addPhysicalCount(count: Omit<PhysicalCount, 'id'>): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "PhysicalCount!A1";

  const id = `PC_${Date.now()}`;
  const values = [[
    id,
    count.countDate,
    count.itemId,
    count.itemCode,
    count.itemName,
    count.countedQuantity,
    count.systemQuantity,
    count.difference,
    count.workerId,
    count.workerName,
    count.area,
    count.status,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}

/**
 * 差異ログを追加
 */
export async function addDiffLog(log: Omit<DiffLog, 'id'>): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "DiffLog!A1";

  const id = `DIFF_${Date.now()}`;
  const values = [[
    id,
    log.physicalCountId,
    log.itemId,
    log.itemCode,
    log.itemName,
    log.difference,
    log.reportedDate,
    log.status,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}

/**
 * トランザクションのステータスを更新
 */
export async function updateTransactionStatus(
  id: string,
  status: "draft" | "pending" | "approved" | "locked",
  approvedBy?: string,
  approvalTime?: string
): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:N1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);
  const idIdx = colIndex("id");

  const rowIndex = rows.findIndex((r) => r[idIdx] === id);
  if (rowIndex === -1) return;

  const statusIdx = colIndex("status");
  const approvedByIdx = colIndex("approved_by");
  const approvalTimeIdx = colIndex("approval_time");

  const updateRange = `Transactions!L${rowIndex + 1}:N${rowIndex + 1}`;
  const values = [[status, approvedBy || "", approvalTime || ""]];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/**
 * 在庫集計を取得
 */
export async function getStockAggregate(): Promise<
  Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    totalQuantity: number;
    area: string;
  }>
> {
  const transactions = await getTransactions();
  const approved = transactions.filter((t) => t.status === "approved");

  const aggregate: Record<
    string,
    {
      itemId: string;
      itemCode: string;
      itemName: string;
      totalQuantity: number;
      area: string;
    }
  > = {};

  approved.forEach((t) => {
    const key = `${t.itemId}_${t.area}`;
    if (!aggregate[key]) {
      aggregate[key] = {
        itemId: t.itemId,
        itemCode: t.itemCode,
        itemName: t.itemName,
        totalQuantity: 0,
        area: t.area,
      };
    }

    if (t.type === "add") {
      aggregate[key].totalQuantity += t.quantity;
    } else {
      aggregate[key].totalQuantity -= t.quantity;
    }
  });

  return Object.values(aggregate);
}

/**
 * ステータスでトランザクションをフィルタリング
 */
export async function getTransactionsByStatus(
  status: "draft" | "pending" | "approved" | "locked"
): Promise<Transaction[]> {
  const transactions = await getTransactions();
  return transactions.filter((t) => t.status === status);
}

/**
 * アイテムコードから商品を検索
 */
export async function searchItems(query: string): Promise<InventoryItem[]> {
  const items = await getItems();
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q)
  );
}

/**
 * コードから1件の商品を取得
 */
export async function getItemByCode(code: string): Promise<InventoryItem | null> {
  const items = await getItems();
  return items.find((item) => item.code === code) || null;
}

/**
 * 新規商品を追加
 */
export async function addItem(item: Omit<InventoryItem, 'id'>): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Items!A1";

  const id = `ITEM_${Date.now()}`;
  const values = [[
    id,
    item.code,
    item.name,
    item.category,
    item.unit,
    item.standardQuantity,
    item.minQuantity,
    item.location,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}

/**
 * すべてのユーザーを取得
 */
export async function getUsers(): Promise<AppUser[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Users!A1:G1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const users = rows.slice(1)
    .map((row) => {
      const activeRaw = row[colIndex("active")];
      const isActive =
        String(activeRaw).toLowerCase() === "true" ||
        String(activeRaw) === "1" ||
        String(activeRaw) === "TRUE";

      return {
        id: String(row[colIndex("id")] || ""),
        loginId: String(row[colIndex("login_id")] || ""),
        passwordHash: String(row[colIndex("password_hash")] || ""),
        role: String(row[colIndex("role")] || "worker"),
        name: String(row[colIndex("name")] || ""),
        area: row[colIndex("area")] ? String(row[colIndex("area")]) : undefined,
        active: isActive,
      };
    })
    .filter((u) => u.active);

  return users;
}

/**
 * 差異ログを取得
 */
export async function getDiffLogs(): Promise<DiffLog[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "DiffLog!A1:H1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const logs = rows.slice(1).map((row) => ({
    id: String(row[colIndex("id")] || ""),
    physicalCountId: String(row[colIndex("physical_count_id")] || ""),
    itemId: String(row[colIndex("item_id")] || ""),
    itemCode: String(row[colIndex("item_code")] || ""),
    itemName: String(row[colIndex("item_name")] || ""),
    difference: Number(row[colIndex("difference")] || 0),
    reportedDate: String(row[colIndex("reported_date")] || ""),
    status: (row[colIndex("status")] as "pending" | "approved" | "locked") || "pending",
  }));

  return logs;
}

/**
 * サプライヤーレポートを追加
 */
export async function addSupplierReport(report: {
  reportDate: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  discrepancy: number;
  reason: string;
}): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "SupplierReports!A1";

  const id = `SR_${Date.now()}`;
  const values = [[
    id,
    report.reportDate,
    report.itemId,
    report.itemCode,
    report.itemName,
    report.discrepancy,
    report.reason,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}
