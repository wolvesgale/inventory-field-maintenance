/**
 * Google Sheets API統合モジュール
 * サービスアカウント認証 + Google Sheets API
 */

import { google } from 'googleapis';
import {
  User,
  Item,
  Transaction,
  PhysicalCount,
  DiffLog,
  SupplierReport,
  StockLedgerEntry,
} from '@/types';

// ============================================================
// 初期化関数
// ============================================================

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n'
  );

  if (!email || !privateKey) {
    throw new Error(
      'Missing Google service account credentials in environment variables'
    );
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) {
    throw new Error('Missing GOOGLE_SHEETS_SPREADSHEET_ID in environment variables');
  }
  return id;
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 行データを型に変換（汎用）
 */
function parseRow<T>(headers: string[], row: any[]): T {
  const obj: any = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? null;
  });
  return obj as T;
}

/**
 * 型オブジェクトを行データに変換（汎用）
 */
function serializeRow(obj: Record<string, any>, headers: string[]): any[] {
  return headers.map((header) => obj[header] ?? '');
}

// ============================================================
// Users シート関連
// ============================================================

const USER_HEADERS = ['id', 'login_id', 'password_hash', 'role', 'name', 'area', 'active'];

export async function getUsers(): Promise<User[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'Users!A2:G',
    });

    const rows = response.data.values || [];
    return rows.map((row) => {
      const user = parseRow<any>(USER_HEADERS, row);
      return {
        id: user.id,
        login_id: user.login_id,
        password_hash: user.password_hash,
        role: user.role,
        name: user.name,
        area: user.area,
        active: user.active === 'TRUE' || user.active === true,
      } as User;
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserByLoginId(login_id: string): Promise<User | null> {
  const users = await getUsers();
  return users.find((u) => u.login_id === login_id) || null;
}

// ============================================================
// Items シート関連
// ============================================================

const ITEM_HEADERS = ['item_code', 'item_name', 'category', 'unit', 'created_at', 'new_flag'];

export async function getItems(): Promise<Item[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'Items!A2:F',
    });

    const rows = response.data.values || [];
    return rows.map((row) => {
      const item = parseRow<any>(ITEM_HEADERS, row);
      return {
        item_code: item.item_code,
        item_name: item.item_name,
        category: item.category || '',
        unit: item.unit || '個',
        created_at: item.created_at,
        new_flag: item.new_flag === 'TRUE' || item.new_flag === true,
      } as Item;
    });
  } catch (error) {
    console.error('Failed to fetch items:', error);
    throw error;
  }
}

export async function getItemByCode(code: string): Promise<Item | null> {
  const items = await getItems();
  return items.find((i) => i.item_code === code) || null;
}

export async function searchItems(query: string): Promise<Item[]> {
  const items = await getItems();
  const lowerQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.item_code.toLowerCase().includes(lowerQuery) ||
      item.item_name.toLowerCase().includes(lowerQuery)
  );
}

export async function addItem(item: Omit<Item, 'id'>): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const row = serializeRow(item, ITEM_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: 'Items!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  } catch (error) {
    console.error('Failed to add item:', error);
    throw error;
  }
}

// ============================================================
// Transactions シート関連
// ============================================================

const TRANSACTION_HEADERS = [
  'id',
  'date',
  'user_id',
  'area',
  'type',
  'item_code',
  'qty',
  'slip_photo_url',
  'status',
  'approved_by',
  'approved_at',
  'comment',
];

export async function getTransactions(): Promise<Transaction[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'Transactions!A2:L',
    });

    const rows = response.data.values || [];
    return rows.map((row) => {
      const tx = parseRow<any>(TRANSACTION_HEADERS, row);
      return {
        id: tx.id,
        date: tx.date,
        user_id: tx.user_id,
        area: tx.area,
        type: tx.type as any,
        item_code: tx.item_code,
        qty: parseInt(tx.qty, 10) || 0,
        slip_photo_url: tx.slip_photo_url || undefined,
        status: tx.status as any,
        approved_by: tx.approved_by || undefined,
        approved_at: tx.approved_at || undefined,
        comment: tx.comment || undefined,
      } as Transaction;
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    throw error;
  }
}

export async function getTransactionsByUserId(userId: string): Promise<Transaction[]> {
  const transactions = await getTransactions();
  return transactions.filter((tx) => tx.user_id === userId);
}

export async function getTransactionsByStatus(status: string): Promise<Transaction[]> {
  const transactions = await getTransactions();
  return transactions.filter((tx) => tx.status === status);
}

export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const id = Date.now().toString();
    const dataToWrite = { id, ...transaction };
    const row = serializeRow(dataToWrite, TRANSACTION_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: 'Transactions!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  } catch (error) {
    console.error('Failed to add transaction:', error);
    throw error;
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: string,
  approvedBy?: string,
  approvedAt?: string
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'Transactions!A:L',
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === transactionId);

    if (rowIndex === -1) {
      throw new Error(`Transaction with ID ${transactionId} not found`);
    }

    const updateRow = [...rows[rowIndex]];
    updateRow[8] = status; // status column
    if (approvedBy) updateRow[9] = approvedBy;
    if (approvedAt) updateRow[10] = approvedAt;

    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range: `Transactions!A${rowIndex + 1}:L${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [updateRow],
      },
    });
  } catch (error) {
    console.error('Failed to update transaction status:', error);
    throw error;
  }
}

// ============================================================
// PhysicalCount シート関連
// ============================================================

const PHYSICAL_COUNT_HEADERS = [
  'id',
  'date',
  'user_id',
  'location',
  'item_code',
  'expected_qty',
  'actual_qty',
];

export async function getPhysicalCounts(): Promise<PhysicalCount[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'PhysicalCount!A2:G',
    });

    const rows = response.data.values || [];
    return rows.map((row) => {
      const pc = parseRow<any>(PHYSICAL_COUNT_HEADERS, row);
      return {
        id: pc.id,
        date: pc.date,
        user_id: pc.user_id,
        location: pc.location,
        item_code: pc.item_code,
        expected_qty: parseInt(pc.expected_qty, 10) || 0,
        actual_qty: parseInt(pc.actual_qty, 10) || 0,
      } as PhysicalCount;
    });
  } catch (error) {
    console.error('Failed to fetch physical counts:', error);
    throw error;
  }
}

export async function addPhysicalCount(pc: Omit<PhysicalCount, 'id'>): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const id = Date.now().toString();
    const dataToWrite = { id, ...pc };
    const row = serializeRow(dataToWrite, PHYSICAL_COUNT_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: 'PhysicalCount!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  } catch (error) {
    console.error('Failed to add physical count:', error);
    throw error;
  }
}

// ============================================================
// DiffLog シート関連
// ============================================================

const DIFF_LOG_HEADERS = [
  'id',
  'date',
  'item_code',
  'expected_qty',
  'actual_qty',
  'diff',
  'reason',
  'resolved_flag',
];

export async function getDiffLogs(): Promise<DiffLog[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'DiffLog!A2:H',
    });

    const rows = response.data.values || [];
    return rows.map((row) => {
      const diff = parseRow<any>(DIFF_LOG_HEADERS, row);
      return {
        id: diff.id,
        date: diff.date,
        item_code: diff.item_code,
        expected_qty: parseInt(diff.expected_qty, 10) || 0,
        actual_qty: parseInt(diff.actual_qty, 10) || 0,
        diff: parseInt(diff.diff, 10) || 0,
        reason: diff.reason || undefined,
        resolved_flag: diff.resolved_flag === 'TRUE' || diff.resolved_flag === true,
      } as DiffLog;
    });
  } catch (error) {
    console.error('Failed to fetch diff logs:', error);
    throw error;
  }
}

export async function addDiffLog(diffLog: Omit<DiffLog, 'id'>): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const id = Date.now().toString();
    const dataToWrite = { id, ...diffLog };
    const row = serializeRow(dataToWrite, DIFF_LOG_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: 'DiffLog!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  } catch (error) {
    console.error('Failed to add diff log:', error);
    throw error;
  }
}

// ============================================================
// SupplierReports シート関連
// ============================================================

const SUPPLIER_REPORT_HEADERS = ['id', 'month', 'item_code', 'item_name', 'qty', 'is_new_item'];

export async function getSupplierReports(): Promise<SupplierReport[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: 'SupplierReports!A2:F',
    });

    const rows = response.data.values || [];
    return rows.map((row) => {
      const report = parseRow<any>(SUPPLIER_REPORT_HEADERS, row);
      return {
        id: report.id,
        month: report.month,
        item_code: report.item_code,
        item_name: report.item_name,
        qty: parseInt(report.qty, 10) || 0,
        is_new_item: report.is_new_item === 'TRUE' || report.is_new_item === true,
      } as SupplierReport;
    });
  } catch (error) {
    console.error('Failed to fetch supplier reports:', error);
    throw error;
  }
}

export async function addSupplierReport(report: Omit<SupplierReport, 'id'>): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const id = Date.now().toString();
    const dataToWrite = { id, ...report };
    const row = serializeRow(dataToWrite, SUPPLIER_REPORT_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: 'SupplierReports!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  } catch (error) {
    console.error('Failed to add supplier report:', error);
    throw error;
  }
}
