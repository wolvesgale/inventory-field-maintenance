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
  approvedBy?: string;
  approvedAt?: string;
  returnComment?: string;
  return_comment?: string;
  returnedAt?: string;
  returnedBy?: string;
  returned_at?: string;
  returned_by?: string;
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
  approvedBy: 11,
  approvedAt: 12,
  returnComment: 13,
  returnedAt: 14,
  returnedBy: 15,
} as const;

type TransactionColumnMap = {
  id: number;
  itemCode: number;
  itemName: number;
  type: number;
  qty: number;
  detail: number;
  locationIndex: number;
  createdBy: number;
  area: number;
  date: number;
  status: number;
  approvedBy: number;
  approvedAt: number;
  returnComment: number;
  returnedAt: number;
  returnedBy: number;
  userId?: number;
  userName?: number;
};

const TRX_COL_COUNT = Object.keys(TRX_COL).length;

function columnLetterFromIndex(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function normalizeHeaderKey(key: string): string {
  return key.replace(/[\s_-]/g, "").toLowerCase();
}

function buildTransactionColumnMap(
  header?: string[]
): { map: TransactionColumnMap; totalColumns: number } {
  const normalized = (header ?? []).map((h) => normalizeHeaderKey(h));
  const findIndex = (candidates: string[]): number | undefined => {
    for (const key of candidates) {
      const idx = normalized.indexOf(key);
      if (idx !== -1) return idx;
    }
    return undefined;
  };

  const map: TransactionColumnMap = {
    id: findIndex(["id"]) ?? TRX_COL.id,
    itemCode: findIndex(["itemcode", "item_code"]) ?? TRX_COL.itemCode,
    itemName: findIndex(["itemname", "item_name"]) ?? TRX_COL.itemName,
    type: findIndex(["type"]) ?? TRX_COL.type,
    qty: findIndex(["qty", "quantity"]) ?? TRX_COL.qty,
    detail: findIndex(["detail", "reason", "memo"]) ?? TRX_COL.detail,
    locationIndex:
      findIndex(["locationindex", "location_index"]) ?? TRX_COL.locationIndex,
    createdBy:
      findIndex([
        "createdby",
        "created_by",
        "requestedby",
        "requested_by",
        "username",
        "user_name",
      ]) ?? TRX_COL.createdBy,
    area: findIndex(["area"]) ?? TRX_COL.area,
    date: findIndex(["date"]) ?? TRX_COL.date,
    status: findIndex(["status"]) ?? TRX_COL.status,
    approvedBy:
      findIndex(["approvedby", "approved_by"]) ?? TRX_COL.approvedBy,
    approvedAt:
      findIndex(["approvedat", "approved_at"]) ?? TRX_COL.approvedAt,
    returnComment:
      findIndex(["returncomment", "return_comment"]) ??
      TRX_COL.returnComment,
    returnedAt:
      findIndex(["returnedat", "returned_at"]) ?? TRX_COL.returnedAt,
    returnedBy:
      findIndex(["returnedby", "returned_by"]) ?? TRX_COL.returnedBy,
  };

  const userIdIdx = findIndex(["userid", "user_id", "user id"]);
  if (userIdIdx !== undefined) {
    map.userId = userIdIdx;
  }
  const userNameIdx = findIndex([
    "user_name",
    "username",
    "user name",
    "requestedby",
    "requested_by",
  ]);
  if (userNameIdx !== undefined) {
    map.userName = userNameIdx;
  } else {
    map.userName = map.createdBy;
  }

  const maxIndex = Math.max(
    ...Object.values(map)
      .filter((v): v is number => typeof v === "number")
      .map((v) => v + 1)
  );
  const headerLength = header?.length ?? 0;
  const totalColumns = Math.max(TRX_COL_COUNT, maxIndex, headerLength);

  return { map, totalColumns };
}

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

type StockLedgerRow = {
  itemCode: string;
  itemName: string;
  openingQty: number;
  closingQty: number;
  initialGroup?: string;
};

async function getStockLedgerMap(): Promise<Map<string, StockLedgerRow>> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "StockLedger!A2:H1000";
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values ?? [];
  const map = new Map<string, StockLedgerRow>();

  for (const row of rows) {
    const itemCode = row[0];
    if (!itemCode) continue;

    const itemName = row[1] ?? "";
    const openingQty = Number(row[2] ?? 0) || 0;
    const closingQty = Number(row[5] ?? 0) || 0;
    const initialGroup = row[7] ?? undefined;

    map.set(String(itemCode), {
      itemCode: String(itemCode),
      itemName,
      openingQty,
      closingQty,
      initialGroup,
    });
  }

  return map;
}

async function updateStockLedgerForApprovedTransaction(tx: Transaction) {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "StockLedger!A1:H1000";
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length === 0) return;

  const header = rows[0];
  const colIndex = (name: string) => header.indexOf(name);

  const idxItemCode = colIndex("item_code");
  const idxItemName = colIndex("item_name");
  const idxOpeningQty = colIndex("opening_qty");
  const idxClosingQty = colIndex("closing_qty");

  if (idxItemCode === -1 || idxClosingQty === -1) {
    console.warn("[StockLedger] Missing required columns");
    return;
  }
  if (!tx.item_code || (tx.type !== "IN" && tx.type !== "OUT")) return;

  const dataRows = rows.slice(1);
  const targetRowIndex = dataRows.findIndex(
    (r) => (r[idxItemCode] ?? "").toString() === tx.item_code
  );

  const absQty = Math.abs(Number(tx.qty) || 0);
  const delta = tx.type === "IN" ? absQty : -absQty;

  if (targetRowIndex >= 0) {
    const nextRow = [...(dataRows[targetRowIndex] || [])];
    while (nextRow.length < header.length) nextRow.push("");

    const currentQty = Number(nextRow[idxClosingQty] ?? 0) || 0;
    nextRow[idxClosingQty] = currentQty + delta;
    if (idxItemName >= 0) {
      nextRow[idxItemName] = tx.item_name || nextRow[idxItemName] || "";
    }

    const updateRange = `StockLedger!A${targetRowIndex + 2}:${columnLetterFromIndex(
      header.length - 1
    )}${targetRowIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [nextRow] },
    });
  } else {
    const newRow = Array(header.length).fill("");
    newRow[idxItemCode] = tx.item_code;
    if (idxItemName >= 0) newRow[idxItemName] = tx.item_name;
    if (idxOpeningQty >= 0) newRow[idxOpeningQty] = 0;
    newRow[idxClosingQty] = delta;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "StockLedger!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [newRow] },
    });
  }
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
function rowToTransaction(
  row: string[],
  colMap: TransactionColumnMap
): Transaction | null {
  if (!row[colMap.id]) return null;

  const qtyRaw = Number(row[colMap.qty] ?? 0);
  const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0;
  const locationRaw = row[colMap.locationIndex];
  const locationIndex = locationRaw ? Number(locationRaw) : null;
  const detail = row[colMap.detail] ?? "";
  const status = (row[colMap.status] as TransactionStatus) || "draft";
  const approvedBy = row[colMap.approvedBy] ?? "";
  const approvedAt = row[colMap.approvedAt] ?? "";
  const returnComment = row[colMap.returnComment] ?? "";
  const returnedAt = row[colMap.returnedAt] ?? "";
  const returnedBy = row[colMap.returnedBy] ?? "";
  const userId = colMap.userId !== undefined ? row[colMap.userId] ?? "" : "";
  const userNameIndex = colMap.userName ?? colMap.createdBy;
  const userName = row[userNameIndex] ?? "";

  return {
    id: String(row[colMap.id]),
    item_code: String(row[colMap.itemCode] ?? ""),
    item_name: String(row[colMap.itemName] ?? ""),
    type: (row[colMap.type] as Transaction["type"]) || "IN",
    qty,
    detail,
    reason: detail,
    location_index: Number.isFinite(locationIndex as number)
      ? locationIndex
      : null,
    user_id: userId,
    user_name: userName,
    area: row[colMap.area] ?? "",
    date: row[colMap.date] ?? "",
    status,
    approved_by: approvedBy || undefined,
    approved_at: approvedAt || undefined,
    approvedBy: approvedBy || undefined,
    approvedAt: approvedAt || undefined,
    returnComment: returnComment || undefined,
    return_comment: returnComment || undefined,
    returnedAt: returnedAt || undefined,
    returnedBy: returnedBy || undefined,
    returned_at: returnedAt || undefined,
    returned_by: returnedBy || undefined,
  };
}

export async function getTransactions(): Promise<Transaction[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:Z1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const header = rows[0] ?? [];
  const { map: colMap } = buildTransactionColumnMap(header);

  const transactions = rows
    .slice(1)
    .map((row) => rowToTransaction(row, colMap))
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
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Transactions!1:1",
  });
  const header = headerRes.data.values?.[0] ?? [];
  const { map: colMap, totalColumns } = buildTransactionColumnMap(header);
  const range = "Transactions!A1";

  const id = `TRX_${Date.now()}`;
  const row = Array(totalColumns).fill("");
  row[colMap.id] = id;
  row[colMap.itemCode] = transaction.item_code;
  row[colMap.itemName] = transaction.item_name;
  row[colMap.type] = transaction.type;
  row[colMap.qty] = transaction.qty;
  row[colMap.detail] = transaction.detail || transaction.reason || "";
  row[colMap.locationIndex] =
    transaction.location_index !== undefined && transaction.location_index !== null
      ? transaction.location_index
      : "";
  const userNameIndex = colMap.userName ?? colMap.createdBy;
  if (userNameIndex !== undefined) {
    row[userNameIndex] = transaction.user_name || transaction.user_id || "";
  }
  if (colMap.userId !== undefined) {
    row[colMap.userId] = transaction.user_id || "";
  }
  row[colMap.area] = transaction.area;
  row[colMap.date] = transaction.date;
  row[colMap.status] = transaction.status;
  row[colMap.approvedBy] = transaction.approved_by ?? transaction.approvedBy ?? "";
  row[colMap.approvedAt] = transaction.approved_at ?? transaction.approvedAt ?? "";
  row[colMap.returnComment] = transaction.returnComment ?? "";
  row[colMap.returnedAt] = transaction.returnedAt ?? "";
  row[colMap.returnedBy] = transaction.returnedBy ?? "";

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
      | "approvedBy"
      | "approvedAt"
      | "returnComment"
      | "return_comment"
      | "returnedAt"
      | "returned_at"
      | "returnedBy"
      | "returned_by"
      | "location_index"
      | "area"
      | "user_name"
      | "user_id"
    >
  >,
): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:Z1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return;

  const header = rows[0] ?? [];
  const { map: colMap, totalColumns } = buildTransactionColumnMap(header);

  const dataRows = rows.slice(1);
  const rowIndex = dataRows.findIndex((r) => r[colMap.id] === id);
  if (rowIndex === -1) return;

  const nextRow = [...(dataRows[rowIndex] || [])];
  const ensureLength = (arr: unknown[], length: number) => {
    while (arr.length < length) arr.push("");
  };
  ensureLength(nextRow, totalColumns);

  if (updates.item_code !== undefined) nextRow[colMap.itemCode] = updates.item_code;
  if (updates.item_name !== undefined) nextRow[colMap.itemName] = updates.item_name;
  if (updates.type !== undefined) nextRow[colMap.type] = updates.type;
  if (updates.qty !== undefined) nextRow[colMap.qty] = updates.qty;
  const detailValue = updates.detail ?? updates.reason;
  if (detailValue !== undefined) nextRow[colMap.detail] = detailValue ?? "";
  if (updates.location_index !== undefined)
    nextRow[colMap.locationIndex] =
      updates.location_index !== null && updates.location_index !== undefined
        ? updates.location_index
        : "";
  if (updates.user_name !== undefined || updates.user_id !== undefined) {
    const userNameIndex = colMap.userName ?? colMap.createdBy;
    nextRow[userNameIndex] = updates.user_name || updates.user_id || "";
    if (colMap.userId !== undefined && updates.user_id !== undefined) {
      nextRow[colMap.userId] = updates.user_id;
    }
  }
  if (updates.area !== undefined) nextRow[colMap.area] = updates.area;
  if (updates.date !== undefined) nextRow[colMap.date] = updates.date;
  if (updates.status !== undefined) nextRow[colMap.status] = updates.status;
  if (updates.approved_by !== undefined || updates.approvedBy !== undefined)
    nextRow[colMap.approvedBy] = updates.approved_by ?? updates.approvedBy ?? "";
  if (updates.approved_at !== undefined || updates.approvedAt !== undefined)
    nextRow[colMap.approvedAt] = updates.approved_at ?? updates.approvedAt ?? "";
  const returnCommentValue = updates.returnComment ?? updates.return_comment;
  if (returnCommentValue !== undefined)
    nextRow[colMap.returnComment] = returnCommentValue ?? "";
  const returnedAtValue = updates.returnedAt ?? updates.returned_at;
  if (returnedAtValue !== undefined) nextRow[colMap.returnedAt] = returnedAtValue ?? "";
  const returnedByValue = updates.returnedBy ?? updates.returned_by;
  if (returnedByValue !== undefined) nextRow[colMap.returnedBy] = returnedByValue ?? "";

  const updateRange = `Transactions!A${rowIndex + 2}:${columnLetterFromIndex(totalColumns - 1)}${rowIndex + 2}`;
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
  actorOrOptions?: string | { actorName?: string | null; returnComment?: string | null },
): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:Z1000";

  const actorName =
    typeof actorOrOptions === "string"
      ? actorOrOptions
      : actorOrOptions?.actorName ?? undefined;
  const returnComment =
    typeof actorOrOptions === "object" && actorOrOptions !== null
      ? actorOrOptions.returnComment
      : undefined;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  const header = rows[0] ?? [];
  const { map: colMap, totalColumns } = buildTransactionColumnMap(header);
  const dataRows = rows.slice(1);
  const rowIndex = dataRows.findIndex((r) => r[colMap.id] === id);
  if (rowIndex === -1) return;

  const nextRow = [...(dataRows[rowIndex] || [])];
  while (nextRow.length < totalColumns) nextRow.push("");

  const existingTx = rowToTransaction(nextRow, colMap);
  const oldStatus = existingTx?.status;
  const isNewlyApproved =
    status === "approved" && oldStatus !== "approved" && oldStatus !== "locked";
  const nowIso = new Date().toISOString();

  nextRow[colMap.status] = status;

  if (status === "approved") {
    if (actorName) {
      nextRow[colMap.approvedBy] = actorName;
      const stamp = `${actorName} / ${nowIso}`;
      nextRow[colMap.detail] = nextRow[colMap.detail]
        ? `${nextRow[colMap.detail]} | 承認: ${stamp}`
        : `承認: ${stamp}`;
    }
    nextRow[colMap.approvedAt] = nowIso;
  }

  if (status === "returned") {
    if (returnComment !== undefined) {
      nextRow[colMap.returnComment] = returnComment;
    }
    if (actorName) {
      nextRow[colMap.returnedBy] = actorName;
    }
    nextRow[colMap.returnedAt] = nowIso;
  }

  const updateRange = `Transactions!A${rowIndex + 2}:${columnLetterFromIndex(totalColumns - 1)}${
    rowIndex + 2
  }`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [nextRow] },
  });

  if (isNewlyApproved && existingTx) {
    try {
      await updateStockLedgerForApprovedTransaction(existingTx);
    } catch (error) {
      console.error("[StockLedger] Failed to update closing_qty", error);
    }
  }
}

/**
 * 在庫集計を取得
 */
export async function getStockAggregate(): Promise<
  Array<{
    item_code: string;
    item_name: string;
    opening_qty: number;
    in_qty: number;
    out_qty: number;
    closing_qty: number;
    new_flag: boolean;
    is_new: boolean;
    initial_group?: string;
  }>
> {
  const [items, transactions, ledgerMap] = await Promise.all([
    getItems(),
    getTransactions(),
    getStockLedgerMap(),
  ]);

  const approved = transactions.filter(
    (t) => t.status === "approved" || t.status === "locked"
  );

  const aggregate = new Map<
    string,
    {
      inQty: number;
      outQty: number;
    }
  >();

  approved.forEach((t) => {
    const entry = aggregate.get(t.item_code) ?? { inQty: 0, outQty: 0 };
    if (t.type === "IN") {
      entry.inQty += t.qty;
    } else if (t.type === "OUT") {
      entry.outQty += t.qty;
    }
    aggregate.set(t.item_code, entry);
  });

  return items.map((item) => {
    const ledger = ledgerMap.get(item.item_code);
    const agg = aggregate.get(item.item_code) ?? { inQty: 0, outQty: 0 };

    const openingFromLedger = ledger?.openingQty ?? 0;
    const computedClosing = openingFromLedger + agg.inQty - agg.outQty;
    const closingFromLedger = ledger?.closingQty ?? 0;
    const closingQty = closingFromLedger ?? computedClosing;

    return {
      item_code: item.item_code,
      item_name: item.item_name,
      opening_qty: openingFromLedger,
      in_qty: agg.inQty,
      out_qty: agg.outQty,
      closing_qty: closingQty,
      new_flag: !!item.new_flag,
      is_new: !!item.new_flag,
      initial_group: ledger?.initialGroup ?? item.initial_group,
    };
  });
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

async function getSheetIdByTitle(title: string): Promise<number | null> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === title);
  return sheet?.properties?.sheetId ?? null;
}

export async function deleteTransactionById(id: string): Promise<void> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = "Transactions!A1:Z1000";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return;

  const header = rows[0] ?? [];
  const { map: colMap } = buildTransactionColumnMap(header);

  const dataRows = rows.slice(1);
  const rowIndex = dataRows.findIndex((r) => r[colMap.id] === id);
  if (rowIndex === -1) return;

  const sheetId = await getSheetIdByTitle("Transactions");
  if (sheetId === null) {
    throw new Error("Transactions シートが見つかりませんでした");
  }

  const startIndex = rowIndex + 1; // ヘッダー行を除いた0-based
  const endIndex = startIndex + 1;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex,
            },
          },
        },
      ],
    },
  });
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
