/**
 * 在庫・棚卸管理システム: TypeScript型定義
 */

// ============================================================
// ユーザー関連型
// ============================================================

export type UserRole = 'worker' | 'manager' | 'admin';

export interface User {
  id: string;
  login_id: string;
  password_hash: string;
  role: UserRole;
  name: string;
  area: string;
  active: boolean;
}

export interface UserSession {
  id: string;
  login_id: string;
  role: UserRole;
  name: string;
  area: string;
}

// NextAuth.js のセッション拡張
declare module 'next-auth' {
  interface Session {
    user: UserSession;
  }
  interface User {
    id: string;
    login_id: string;
    role: UserRole;
    name: string;
    area: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    login_id?: string;
    role?: UserRole;
    name?: string;
    area?: string;
  }
}

// ============================================================
// 品目マスタ関連型
// ============================================================

export interface Item {
  id?: string;
  item_code: string;
  item_name: string;
  category?: string;
  unit: string;
  created_at: string;
  new_flag: boolean;
}

// ============================================================
// 入出庫取引関連型
// ============================================================

export type TransactionType = 'IN' | 'OUT';
export type TransactionStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'returned'
  | 'locked';

export interface Transaction {
  id?: string;
  item_code: string;
  item_name: string;
  type: TransactionType;
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
}

// ============================================================
// 在庫台帳関連型
// ============================================================

export interface StockLedgerEntry {
  id?: string;
  item_code: string;
  item_name: string;
  opening_qty: number;
  in_qty: number;
  out_qty: number;
  closing_qty: number;
  new_flag: boolean;
}

// ============================================================
// 棚卸関連型
// ============================================================

export interface PhysicalCount {
  id?: string;
  date: string;
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number;
  difference: number;
  user_id: string;
  user_name: string;
  location: string;
  status: 'draft' | 'confirmed';
}

export interface DiffLog {
  id?: string;
  physical_count_id: string;
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number;
  diff: number;
  reason?: string;
  status: 'pending' | 'approved' | 'locked';
}

// ============================================================
// メーカー報告関連型
// ============================================================

export interface SupplierReport {
  id?: string;
  month: string;
  item_code: string;
  item_name: string;
  qty: number;
  is_new_item: boolean;
}

// ============================================================
// API レスポンス型
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// フロント画面用の集計・ビュー型
// ============================================================

export interface StockViewItem extends StockLedgerEntry {
  is_new: boolean;
}

export type TransactionView = Omit<Transaction, 'user_name' | 'item_name'> & {
  user_name?: string;
  item_name?: string;
};

export interface ApprovalItem extends TransactionView {
  can_approve: boolean;
}

export interface MonthlyReportItem {
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number;
  diff: number;
  has_diff: boolean;
  is_new_item: boolean;
}
