// lib/sheets.ts
import { google } from "googleapis";

export type AppUser = {
  id: string;
  login_id: string;
  /**
   * NOTE:
   *  従来は bcrypt のハッシュを入れていたが、
   *  現在は「平文パスワード」をそのまま格納する運用にする。
   */
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
  initial_group?: string; // 追加: StockLedger のグループをここに入れる
};

export type TransactionStatus =
  | "draft"
  | "pending"
  | "approved"
  | "returned"
  | "locked";

export type Transaction = {
  id: string;
  item_code: string;
  item_name: string;
  type: "IN" | "OUT";
  qty: number;
  detail?: string;
  reason?: string;
  location_index?: number | null;
  user_id?: string;
  user_name?: string;
  area: string;
  date: string;
  status: TransactionStatus;
  approved_by?: string;
  approved_at?: string;
};

// Transactions シートの列マッピング（0-based）
const TRX_COL = {
  id: 0,
  itemCode: 1,
  itemName: 2,
  type: 3,
  qty: 4,
  detail: 5,
  locationIndex: 6,
  createdBy: 7,
  area: 8,
  date: 9,
  status: 10,
} as const;

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
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.error("[DEBUG sheets] Missing environment variables:", {
      hasEmail: !!clientEmail,
      hasKey: !!privateKey,
      hasSpreadsheetId: !!spreadsheetId,
      envKeys: Object.keys(process.env).filter(
        (k) => k.includes("GOOGLE") || k.includes("SHEETS")
      ),
    });
    throw new Error(
      "Google Sheets の環境変数が不足しています。.env.local に以下を設定してください: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID"
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, spreadsheetId };
}

export async function getUserByLoginId(
  login_id: string
): Promise<AppUser | null> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Users!A1:G1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) {
    console.log("[DEBUG sheets] No rows found in Users sheet");
    return null;
  }

  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log("[DEBUG sheets] Header:", header);

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
    console.error("[DEBUG sheets] Column index error:", {
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

  const row = dataRows.find((r) => r[idxLoginId] === login_id);
  console.log("[DEBUG sheets] Looking for login_id:", login_id);
  console.log(
    "[DEBUG sheets] Found row:",
    row ? { ...row } : null
  );

  if (!row) {
    console.log("[DEBUG sheets] No matching row found");
    return null;
  }

  const activeRaw = row[idxActive];
  const isActive =
    String(activeRaw).toLowerCase() === "true" ||
    String(activeRaw) === "1" ||
    String(activeRaw) === "TRUE";

  console.log("[DEBUG sheets] Active check:", { activeRaw, isActive });

  if (!isActive) {
    console.log("[DEBUG sheets] User is not active");
    return null;
  }

  const user: AppUser = {
    id: String(row[idxId]),
    login_id: String(row[idxLoginId]),
    // ★ ここに「平文パスワード」をそのまま入れておく
    password_hash: String(row[idxPassword] ?? ""),
    role: String(row[idxRole] ?? "worker"),
    name: String(row[idxName] ?? ""),
    area: idxArea >= 0 ? String(row[idxArea] ?? "") : undefined,
    active: isActive,
  };

  console.log("[DEBUG sheets] Returning user:", {
    ...user,
    password_hash: "***",
  });
  return user;
}

/**
 * 全商品を取得
 */
export async function getItems(): Promise<InventoryItem[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Items!A1:Z1000";

  // Items シート読み込み
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const idxId = colIndex("id");
  const idxItemCode = colIndex("item_code");
  const idxItemName = colIndex("item_name");
  const idxCategory = colIndex("category");
  const idxUnit = colIndex("unit");
  const idxCreatedAt = colIndex("created_at");
  const idxNewFlag = colIndex("new_flag");
  const idxInitialGroup = colIndex("initial_group");

  let items: InventoryItem[] = rows
    .slice(1)
    .map((row) => ({
      id: String(row[idxId] || ""),
      item_code: String(row[idxItemCode] || ""),
      item_name: String(row[idxItemName] || ""),
      category: String(row[idxCategory] || ""),
      unit: String(row[idxUnit] || ""),
      created_at:
        idxCreatedAt >= 0 && row[idxCreatedAt]
          ? String(row[idxCreatedAt])
          : undefined,
      new_flag:
        idxNewFlag >= 0
          ? String(row[idxNewFlag] || "").toLowerCase() === "true"
          : undefined,
      initial_group:
        idxInitialGroup >= 0 && row[idxInitialGroup]
          ? String(row[idxInitialGroup]).trim()
          : undefined,
    }))
    .filter((item) => item.item_code);

  // 🔁 StockLedger から initial_group を補完
  if (items.some((item) => !item.initial_group)) {
    const ledgerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "StockLedger!A1:H1000",
    });

    const ledgerRows = ledgerRes.data.values || [];
    if (ledgerRows.length >= 2) {
      const ledgerHeader = ledgerRows[0];
      const ledgerColIndex = (name: string) => ledgerHeader.indexOf(name);

      const idxLedgerItemCode = ledgerColIndex("item_code");
      const idxLedgerInitialGroup = ledgerColIndex("initial_group");

      if (idxLedgerItemCode !== -1 && idxLedgerInitialGroup !== -1) {
        const ledgerMap = new Map<string, string>();

        for (const row of ledgerRows.slice(1)) {
          const code = String(row[idxLedgerItemCode] || "").trim();
          const group = String(row[idxLedgerInitialGroup] || "").trim();
          if (code && group && !ledgerMap.has(code)) {
            ledgerMap.set(code, group);
          }
        }

        items = items.map((item) => {
          if (item.initial_group && item.initial_group.trim() !== "") {
            return item;
          }

          const fallback = ledgerMap.get(item.item_code);
          return fallback ? { ...item, initial_group: fallback } : item;
        });
      }
    }
  }

  return items;
}

/**
 * 全トランザクションを取得
 */
function rowToTransaction(row: string[]): Transaction | null {
  if (!row[TRX_COL.id]) return null;

  const qtyRaw = Number(row[TRX_COL.qty] ?? 0);
  const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0;
  const locationRaw = row[TRX_COL.locationIndex];
  const locationIndex = locationRaw ? Number(locationRaw) : null;
  const detail = row[TRX_COL.detail] ?? "";
  const status = (row[TRX_COL.status] as TransactionStatus) || "draft";

  return {
    id: String(row[TRX_COL.id]),
    item_code: String(row[TRX_COL.itemCode] ?? ""),
    item_name: String(row[TRX_COL.itemName] ?? ""),
    type: (row[TRX_COL.type] as Transaction["type"]) || "IN",
    qty,
    detail,
    reason: detail,
    location_index: Number.isFinite(locationIndex as number)
      ? locationIndex
      : null,
    user_id: row[TRX_COL.createdBy] ?? "",
    user_name: row[TRX_COL.createdBy] ?? "",
    area: row[TRX_COL.area] ?? "",
    date: row[TRX_COL.date] ?? "",
    status,
  };
}

export async function getTransactions(): Promise<Transaction[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:K1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const transactions = rows
    .slice(1)
    .map((row) => rowToTransaction(row))
    .filter((tx): tx is Transaction => Boolean(tx));

  return transactions;
}

/**
 * ID でトランザクションを取得
 */
export async function getTransactionById(id: string): Promise<Transaction | null> {
  const transactions = await getTransactions();
  return transactions.find((tx) => tx.id === id) || null;
}

/**
 * 新規トランザクションを追加
 */
export async function addTransaction(
  transaction: Omit<Transaction, "id">
): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1";

  const id = `TRX_${Date.now()}`;
  const row = Array(11).fill("");
  row[TRX_COL.id] = id;
  row[TRX_COL.itemCode] = transaction.item_code;
  row[TRX_COL.itemName] = transaction.item_name;
  row[TRX_COL.type] = transaction.type;
  row[TRX_COL.qty] = transaction.qty;
  row[TRX_COL.detail] = transaction.detail || transaction.reason || "";
  row[TRX_COL.locationIndex] =
    transaction.location_index !== undefined && transaction.location_index !== null
      ? transaction.location_index
      : "";
  row[TRX_COL.createdBy] = transaction.user_name || transaction.user_id || "";
  row[TRX_COL.area] = transaction.area;
  row[TRX_COL.date] = transaction.date;
  row[TRX_COL.status] = transaction.status;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return id;
}

/**
 * トランザクション内容を更新（数量・種別・理由・日付など）
 */
export async function updateTransaction(
  id: string,
  updates: Partial<
    Pick<
      Transaction,
      | "item_code"
      | "item_name"
      | "type"
      | "qty"
      | "detail"
      | "reason"
      | "date"
      | "status"
      | "approved_by"
      | "approved_at"
      | "location_index"
      | "area"
      | "user_name"
      | "user_id"
    >
  >,
): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:K1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return;

  const dataRows = rows.slice(1);
  const rowIndex = dataRows.findIndex((r) => r[TRX_COL.id] === id);
  if (rowIndex === -1) return;

  const nextRow = [...(dataRows[rowIndex] || [])];
  const ensureLength = (arr: unknown[], length: number) => {
    while (arr.length < length) arr.push("");
  };
  ensureLength(nextRow, 11);

  if (updates.item_code !== undefined) nextRow[TRX_COL.itemCode] = updates.item_code;
  if (updates.item_name !== undefined) nextRow[TRX_COL.itemName] = updates.item_name;
  if (updates.type !== undefined) nextRow[TRX_COL.type] = updates.type;
  if (updates.qty !== undefined) nextRow[TRX_COL.qty] = updates.qty;
  const detailValue = updates.detail ?? updates.reason;
  if (detailValue !== undefined) nextRow[TRX_COL.detail] = detailValue ?? "";
  if (updates.location_index !== undefined)
    nextRow[TRX_COL.locationIndex] =
      updates.location_index !== null && updates.location_index !== undefined
        ? updates.location_index
        : "";
  if (updates.user_name !== undefined || updates.user_id !== undefined) {
    nextRow[TRX_COL.createdBy] = updates.user_name || updates.user_id || "";
  }
  if (updates.area !== undefined) nextRow[TRX_COL.area] = updates.area;
  if (updates.date !== undefined) nextRow[TRX_COL.date] = updates.date;
  if (updates.status !== undefined) nextRow[TRX_COL.status] = updates.status;

  const updateRange = `Transactions!A${rowIndex + 2}:K${rowIndex + 2}`;
  const values = [nextRow];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
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
    status:
      (row[colIndex("status")] as "draft" | "confirmed") || "draft",
  }));

  return counts;
}

/**
 * 新規棚卸データを追加
 */
export async function addPhysicalCount(
  count: Omit<PhysicalCount, "id">
): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "PhysicalCount!A1";

  const id = `PC_${Date.now()}`;
  const values = [
    [
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
    ],
  ];

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
export async function addDiffLog(
  log: Omit<DiffLog, "id">
): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "DiffLog!A1";

  const id = `DIFF_${Date.now()}`;
  const values = [
    [
      id,
      log.physical_count_id,
      log.item_code,
      log.item_name,
      log.expected_qty,
      log.actual_qty,
      log.diff,
      log.reason || "",
      log.status,
    ],
  ];

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
  status: TransactionStatus,
  approved_by?: string | null,
): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:K1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  const dataRows = rows.slice(1);
  const rowIndex = dataRows.findIndex((r) => r[TRX_COL.id] === id);
  if (rowIndex === -1) return;

  const nextRow = [...(dataRows[rowIndex] || [])];
  while (nextRow.length < 11) nextRow.push("");

  nextRow[TRX_COL.status] = status;

  if (approved_by) {
    const stamp = `${approved_by} / ${new Date().toISOString()}`;
    nextRow[TRX_COL.detail] = nextRow[TRX_COL.detail]
      ? `${nextRow[TRX_COL.detail]} | 承認: ${stamp}`
      : `承認: ${stamp}`;
  }

  const updateRange = `Transactions!A${rowIndex + 2}:K${rowIndex + 2}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [nextRow] },
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
  status: TransactionStatus
): Promise<Transaction[]> {
  const transactions = await getTransactions();
  return transactions.filter((t) => t.status === status);
}

/**
 * アイテムコードから商品を検索
 */
export async function searchItems(
  query: string
): Promise<InventoryItem[]> {
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
export async function getItemByCode(
  item_code: string
): Promise<InventoryItem | null> {
  const items = await getItems();
  return items.find((item) => item.item_code === item_code) || null;
}

/**
 * 新規商品を追加
 */
export async function addItem(
  item: Omit<InventoryItem, "id">
): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Items!A1";

  const id = `ITEM_${Date.now()}`;
  const values = [
    [
      id,
      item.item_code,
      item.item_name,
      item.category,
      item.unit,
      item.created_at || "",
      item.new_flag ? "true" : "false",
    ],
  ];

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

  const users = rows
    .slice(1)
    .map((row) => {
      const activeRaw = row[colIndex("active")];
      const isActive =
        String(activeRaw).toLowerCase() === "true" ||
        String(activeRaw) === "1" ||
        String(activeRaw) === "TRUE";

      return {
        id: String(row[colIndex("id")] || ""),
        login_id: String(row[colIndex("login_id")] || ""),
        // ここにも平文パスワードがそのまま入る
        password_hash: String(row[colIndex("password_hash")] || ""),
        role: String(row[colIndex("role")] || "worker"),
        name: String(row[colIndex("name")] || ""),
        area: row[colIndex("area")]
          ? String(row[colIndex("area")])
          : undefined,
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
    physical_count_id: String(
      row[colIndex("physical_count_id")] || ""
    ),
    item_code: String(row[colIndex("item_code")] || ""),
    item_name: String(row[colIndex("item_name")] || ""),
    expected_qty: Number(row[colIndex("expected_qty")] || 0),
    actual_qty: Number(row[colIndex("actual_qty")] || 0),
    diff: Number(row[colIndex("diff")] || 0),
    reason: row[colIndex("reason")]
      ? String(row[colIndex("reason")])
      : undefined,
    status:
      (row[colIndex("status")] as "pending" | "approved" | "locked") ||
      "pending",
  }));

  return logs;
}

/**
 * サプライヤーレポートを追加
 */
export async function addSupplierReport(
  report: Omit<SupplierReport, "id">
): Promise<string> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "SupplierReports!A1";

  const id = `SR_${Date.now()}`;
  const values = [
    [
      id,
      report.month,
      report.item_code,
      report.item_name,
      report.qty,
      report.is_new_item ? "true" : "false",
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return id;
}

/**
 * ユーザーのパスワードを更新（password_hash 列に平文を書き込む）
 */
export async function updateUserPassword(
  loginId: string,
  newPassword: string
): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Users!A1:G1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) {
    throw new Error("Users シートにデータがありません");
  }

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const loginIdx = colIndex("login_id");
  const passwordIdx = colIndex("password_hash");

  if (loginIdx === -1 || passwordIdx === -1) {
    throw new Error("Users シートのヘッダが想定と異なります");
  }

  const rowIndex = rows.findIndex((r) => r[loginIdx] === loginId);
  if (rowIndex === -1) {
    throw new Error(`User not found for login_id: ${loginId}`);
  }

  const columnLetter = String.fromCharCode(65 + passwordIdx); // A=0
  const targetRange = `Users!${columnLetter}${rowIndex + 1}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: targetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[newPassword]],
    },
  });
}
