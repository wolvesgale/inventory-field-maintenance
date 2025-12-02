// lib/sheets.ts
import { google } from "googleapis";

export type AppUser = {
  id: string;
  login_id: string;
  password_hash: string;
  role: "worker" | "manager" | "admin" | string;
  name: string;
  area?: string;
  active: boolean;
};

export type InventoryItem = {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
  created_at?: string;
  new_flag?: boolean;
};

export type Transaction = {
  id: string;
  item_code: string;
  item_name: string;
  type: "IN" | "OUT";
  qty: number;
  reason?: string;
  user_id: string;
  user_name: string;
  area: string;
  date: string;
  status: "draft" | "pending" | "approved" | "locked";
  approved_by?: string;
  approved_at?: string;
};

export type PhysicalCount = {
  id: string;
  date: string;
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number;
  difference: number;
  user_id: string;
  user_name: string;
  location: string;
  status: "draft" | "confirmed";
};

export type DiffLog = {
  id: string;
  physical_count_id: string;
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number;
  diff: number;
  reason?: string;
  status: "pending" | "approved" | "locked";
};

export type SupplierReport = {
  id: string;
  month: string;
  item_code: string;
  item_name: string;
  qty: number;
  is_new_item: boolean;
};

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SPREADSHEET_ID?.trim();

  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID && process.env.GOOGLE_SPREADSHEET_ID) {
    console.warn(
      '[DEBUG sheets] GOOGLE_SPREADSHEET_ID is set. Please rename it to GOOGLE_SHEETS_SPREADSHEET_ID so it matches the code.'
    );
  }

  if (!clientEmail || !privateKeyRaw || !spreadsheetId) {
    console.error('[DEBUG sheets] Missing environment variables:', {
      hasEmail: !!clientEmail,
      hasKey: !!privateKeyRaw,
      hasSpreadsheetId: !!spreadsheetId,
      envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('SHEETS')),
    });
    throw new Error(
      "Google Sheets の環境変数が不足しています。.env.local に以下を設定してください: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID"
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKeyRaw.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, spreadsheetId };
}

export async function getUserByLoginId(login_id: string): Promise<AppUser | null> {
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

  const normalizedLoginId = login_id.trim();
  const row = dataRows.find(
    (r) => String(r[idxLoginId]).trim() === normalizedLoginId
  );
  console.log('[DEBUG sheets] Looking for login_id:', normalizedLoginId);
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
    login_id: String(row[idxLoginId]),
    password_hash: String(row[idxPassword] ?? ""),
    role: String(row[idxRole] ?? "worker"),
    name: String(row[idxName] ?? ""),
    area: idxArea >= 0 ? String(row[idxArea] ?? "") : undefined,
    active: isActive,
  };

  console.log('[DEBUG sheets] Returning user:', { ...user, password_hash: '***' });
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
    item_code: String(row[colIndex("item_code")] || ""),
    item_name: String(row[colIndex("item_name")] || ""),
    category: String(row[colIndex("category")] || ""),
    unit: String(row[colIndex("unit")] || ""),
    created_at: row[colIndex("created_at")] ? String(row[colIndex("created_at")]) : undefined,
    new_flag: String(row[colIndex("new_flag")] || "").toLowerCase() === "true",
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
    item_code: String(row[colIndex("item_code")] || ""),
    item_name: String(row[colIndex("item_name")] || ""),
    type: (row[colIndex("type")] as "IN" | "OUT") || "IN",
    qty: Number(row[colIndex("qty")] || 0),
    reason: row[colIndex("reason")] ? String(row[colIndex("reason")]) : undefined,
    user_id: String(row[colIndex("user_id")] || ""),
    user_name: String(row[colIndex("user_name")] || ""),
    area: String(row[colIndex("area")] || ""),
    date: String(row[colIndex("date")] || ""),
    status: (row[colIndex("status")] as "draft" | "pending" | "approved" | "locked") || "draft",
    approved_by: row[colIndex("approved_by")] ? String(row[colIndex("approved_by")]) : undefined,
    approved_at: row[colIndex("approved_at")] ? String(row[colIndex("approved_at")]) : undefined,
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
    transaction.item_code,
    transaction.item_name,
    transaction.type,
    transaction.qty,
    transaction.reason || "",
    transaction.user_id,
    transaction.user_name,
    transaction.area,
    transaction.date,
    transaction.status,
    transaction.approved_by || "",
    transaction.approved_at || "",
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
    date: String(row[colIndex("date")] || ""),
    item_code: String(row[colIndex("item_code")] || ""),
    item_name: String(row[colIndex("item_name")] || ""),
    expected_qty: Number(row[colIndex("expected_qty")] || 0),
    actual_qty: Number(row[colIndex("actual_qty")] || 0),
    difference: Number(row[colIndex("difference")] || 0),
    user_id: String(row[colIndex("user_id")] || ""),
    user_name: String(row[colIndex("user_name")] || ""),
    location: String(row[colIndex("location")] || ""),
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
    count.date,
    count.item_code,
    count.item_name,
    count.expected_qty,
    count.actual_qty,
    count.difference,
    count.user_id,
    count.user_name,
    count.location,
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
    log.physical_count_id,
    log.item_code,
    log.item_name,
    log.expected_qty,
    log.actual_qty,
    log.diff,
    log.reason || "",
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
  approved_by?: string,
  approved_at?: string
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
  const approvedAtIdx = colIndex("approved_at");

  const updateRange = `Transactions!${String.fromCharCode(65 + statusIdx)}${rowIndex + 1}:${String.fromCharCode(65 + approvedAtIdx)}${rowIndex + 1}`;
  const values = [[status, approved_by || "", approved_at || ""]];

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
    item_code: string;
    item_name: string;
    total_qty: number;
    area: string;
  }>
> {
  const transactions = await getTransactions();
  const approved = transactions.filter((t) => t.status === "approved");

  const aggregate: Record<
    string,
    {
      item_code: string;
      item_name: string;
      total_qty: number;
      area: string;
    }
  > = {};

  approved.forEach((t) => {
    const key = `${t.item_code}_${t.area}`;
    if (!aggregate[key]) {
      aggregate[key] = {
        item_code: t.item_code,
        item_name: t.item_name,
        total_qty: 0,
        area: t.area,
      };
    }

    if (t.type === "IN") {
      aggregate[key].total_qty += t.qty;
    } else {
      aggregate[key].total_qty -= t.qty;
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
      item.item_code.toLowerCase().includes(q) ||
      item.item_name.toLowerCase().includes(q)
  );
}

/**
 * コードから1件の商品を取得
 */
export async function getItemByCode(item_code: string): Promise<InventoryItem | null> {
  const items = await getItems();
  return items.find((item) => item.item_code === item_code) || null;
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
    item.item_code,
    item.item_name,
    item.category,
    item.unit,
    item.created_at || "",
    item.new_flag ? "true" : "false",
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
        login_id: String(row[colIndex("login_id")] || ""),
        password_hash: String(row[colIndex("password_hash")] || ""),
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
  const range = "DiffLog!A1:I1000";

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
    physical_count_id: String(row[colIndex("physical_count_id")] || ""),
    item_code: String(row[colIndex("item_code")] || ""),
    item_name: String(row[colIndex("item_name")] || ""),
    expected_qty: Number(row[colIndex("expected_qty")] || 0),
    actual_qty: Number(row[colIndex("actual_qty")] || 0),
    diff: Number(row[colIndex("diff")] || 0),
    reason: row[colIndex("reason")] ? String(row[colIndex("reason")]) : undefined,
    status: (row[colIndex("status")] as "pending" | "approved" | "locked") || "pending",
  }));

  return logs;
}

/**
 * サプライヤーレポートを追加
 */
export async function addSupplierReport(report: Omit<SupplierReport, 'id'>): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "SupplierReports!A1";

  const id = `SR_${Date.now()}`;
  const values = [[
    id,
    report.month,
    report.item_code,
    report.item_name,
    report.qty,
    report.is_new_item ? "true" : "false",
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}
