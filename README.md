# 在庫・棚卸管理 Webアプリ

## 概要

このプロジェクトは、在庫管理と月末棚卸業務をデジタル化するWebアプリケーションです。

**主な機能：**
- **入出庫登録**：現場担当が入荷・納品・出庫を登録
- **承認フロー**：マネージャーが登録内容を確認・承認
- **在庫台帳**：リアルタイムで在庫状況を可視化
- **棚卸**：月末棚卸（実在庫カウント）と差異検出
- **月次レポート**：差異分析とメーカー報告書生成

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **認証**: NextAuth.js (Credentials Provider)
- **UI**: Tailwind CSS
- **データベース**: Google Sheets API
- **パスワード管理**: bcryptjs

## インストール＆セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/wolvesgale/inventory-field-maintenance.git
cd inventory-field-maintenance
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルをプロジェクト直下に作成し、以下の環境変数を設定してください。
（`.env.local` は `.gitignore` に含まれるため、秘密情報はコミットされません）

```bash
# NextAuth設定
NEXTAUTH_SECRET=your-random-secret-key-32-chars-or-more

# Google Sheets API設定
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxxxx@xxxxx.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=1hKEw4t0X64GrfHIyXvQYTZ8_EUMBfWEknB_W_QBAk0Q
```

**重要**: 
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` の改行は `\n` として記述してください
- 秘密鍵の前後の `"-----BEGIN PRIVATE KEY-----"` と `"-----END PRIVATE KEY-----"` は含める必要があります
- `.env.local` をコミットしないよう、`.gitignore` で除外されていることを確認してください

### 4. ローカルサーバーを起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000/login` にアクセスしてください。

## 使用方法

### ロール定義

| ロール | 権限 |
|--------|------|
| **worker** | 入出庫登録、自分の履歴閲覧 |
| **manager** | worker + 承認、在庫台帳、棚卸、月次レポート |
| **admin** | 全権限 |

### Google Sheets側の初期設定

以下のシートタブを作成してください：

#### Users シート（ログイン情報）
| id | login_id | password_hash | role | name | area | active |
|---|---|---|---|---|---|---|
| 1 | t_yamada | bcrypt hash | worker | 山田太郎 | 大阪 | TRUE |
| 2 | s_suzuki | bcrypt hash | manager | 鈴木次郎 | 関西 | TRUE |

**password_hash**: `bcryptjs`で生成したハッシュ値

#### Items シート（品目マスタ）
| item_code | item_name | category | unit | created_at | new_flag |
|---|---|---|---|---|---|
| 864896000 | ＳＡＤ１ プッシュスイッチ | - | 個 | 2025-11-01 | FALSE |

#### Transactions シート（入出庫履歴）
| id | date | user_id | area | type | item_code | qty | slip_photo_url | status | approved_by | approved_at | comment |
|---|---|---|---|---|---|---|---|---|---|---|---|
| （自動採番） | 2025-11-15 | 1 | 大阪 | IN | 864896000 | 2 | - | pending | - | - | - |

#### PhysicalCount シート（棚卸結果）
| id | date | user_id | location | item_code | expected_qty | actual_qty |
|---|---|---|---|---|---|---|
| - | - | - | - | - | - | - |

#### DiffLog シート（差異ログ）
| id | date | item_code | expected_qty | actual_qty | diff | reason | resolved_flag |
|---|---|---|---|---|---|---|---|
| - | - | - | - | - | - | - | FALSE |

#### SupplierReports シート（メーカー報告用）
| id | month | item_code | item_name | qty | is_new_item |
|---|---|---|---|---|---|
| - | - | - | - | - | FALSE |

#### StockLedger シート（在庫台帳）
※ このアプリではリアルタイム集計のため、このシートは参照のみです。

## Google Sheets API設定

### 1. GCPプロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクトを作成
3. **Google Sheets API** を有効化

### 2. サービスアカウント作成と秘密鍵の取得

1. 「IAMと管理」 → 「認証情報」 → 「認証情報を作成」 → 「サービスアカウント」
2. サービスアカウント名を入力（例：`inventory-sheets`）
3. 作成後、作成したサービスアカウントをクリック
4. 「キー」タブで 「鍵を追加」 → 「新しい鍵を作成」 → 「JSON」を選択
5. ダウンロードされた JSON ファイルから以下の情報を抽出：
   ```json
   {
     "type": "service_account",
     "project_id": "...",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "xxxx@xxxx.iam.gserviceaccount.com",
     ...
   }
   ```
   - `client_email` を `GOOGLE_SERVICE_ACCOUNT_EMAIL` に設定
   - `private_key` を `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` に設定（`\n` は改行のままで OK）

### 3. スプレッドシートの準備と共有

1. [Google Sheets](https://sheets.google.com) で新規スプレッドシートを作成
2. スプレッドシートを開き、URL から ID を取得：
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```
3. 共有ボタンをクリックし、サービスアカウントの `client_email` に **編集者** 権限を付与
4. 取得した `SPREADSHEET_ID` を `.env.local` の `GOOGLE_SHEETS_SPREADSHEET_ID` に設定

### 4. シートの設定

スプレッドシート内に以下のシート（タブ）を作成してください：

| シート名 | 説明 | ヘッダ行の例 |
|---------|------|-----------|
| `Users` | ユーザー（従業員）マスター | id, login_id, password_hash, role, name, area, active |
| `Items` | 商品マスター | id, code, name, category, unit, standard_quantity, min_quantity, location |
| `Transactions` | 入出庫トランザクション | id, item_id, item_code, item_name, type, quantity, reason, worker_id, worker_name, area, timestamp, status, approved_by, approval_time |
| `PhysicalCount` | 月末棚卸データ | id, count_date, item_id, item_code, item_name, counted_quantity, system_quantity, difference, worker_id, worker_name, area, status |
| `DiffLog` | 差異ログ | id, physical_count_id, item_id, item_code, item_name, difference, reported_date, status |
| `SupplierReports` | メーカー報告書 | id, report_date, item_id, item_code, item_name, discrepancy, reason |

## デプロイ

### Vercel へのデプロイ

```bash
npm run build
```

[Vercel](https://vercel.com) にプッシュしてください。環境変数を設定してください：
- `NEXTAUTH_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

## ディレクトリ構造

```
inventory-field-maintenance/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth ハンドラー
│   │   ├── items/search/          # 品目検索API
│   │   ├── transactions/          # 取引一覧API
│   │   ├── approve/               # 承認API
│   │   ├── stock/                 # 在庫集計API
│   │   ├── physical-count/        # 棚卸保存API
│   │   └── monthly-report/        # 月次レポートAPI
│   ├── dashboard/                 # ダッシュボード
│   ├── login/                     # ログイン画面
│   ├── transactions/              # 取引管理
│   ├── approve/                   # 承認画面
│   ├── stock/                     # 在庫台帳
│   ├── physical-count/            # 棚卸
│   ├── reports/monthly/           # 月次レポート
│   ├── layout.tsx                 # ルートレイアウト
│   ├── page.tsx                   # ホーム（/）
│   └── globals.css                # グローバルスタイル
├── components/
│   ├── Navigation.tsx             # ナビゲーションバー
│   └── StatusBadge.tsx            # ステータス表示
├── lib/
│   └── sheets.ts                  # Google Sheets API統合
├── types/
│   └── index.ts                   # TypeScript型定義
├── auth.ts                        # NextAuth メイン設定
├── auth.config.ts                 # NextAuth 設定
├── middleware.ts                  # ルート保護
├── .env.example                   # 環境変数テンプレート
└── README.md                      # このファイル
```

## トラブルシューティング

### ログイン失敗エラー

**原因**: Users シートの password_hash が正しくない

**解決**:
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 10))"
```
で正しいハッシュを生成して設定

### スプレッドシート接続エラー

**原因**: 
- サービスアカウントの認証情報が誤っている
- スプレッドシートが共有されていない

**解決**:
- 環境変数を確認
- スプレッドシートがサービスアカウントに共有されているか確認

### API呼び出しエラー

**原因**: Google Sheets API の割り当て上限に達した

**解決**: [Google Cloud Console](https://console.cloud.google.com/) で割り当て制限を確認・増加

## ライセンス

このプロジェクトはプライベートプロジェクトです。

## サポート

問題が発生した場合は、GitHub Issues で報告してください。
