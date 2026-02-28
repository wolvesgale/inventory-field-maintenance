# システム構成レビュー・課題整理

> 作成日: 2026-02-28
> 対象: 在庫・棚卸管理 Webアプリ（inventory-field-maintenance）
> スコープ: 構造的問題・運用リスク（セキュリティは別途）

---

## 1. システム構成サマリー

### 技術スタック（実態）

| 要素 | 内容 |
|---|---|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| 認証 | NextAuth.js 4.24 / Credentials Provider / JWT セッション |
| データストア | Google Sheets（単一スプレッドシート） |
| スプシアクセス | Google Service Account（googleapis SDK） |
| ホスティング | Vercel 想定 |
| UI | Tailwind CSS v4 |

### シート構成（現在の実態）

| シート名 | 役割 |
|---|---|
| Users | ユーザーマスタ（認証情報・ロール含む） |
| Items | 品目マスタ |
| Transactions | 入出庫トランザクション（主データ） |
| StockLedger | 在庫台帳（期首・期末残高） |
| PhysicalCount | 棚卸実績 |
| DiffLog | 棚卸差異ログ |
| SupplierReports | 月次メーカー報告書 |

### ロール体系

| ロール | 権限範囲 |
|---|---|
| worker | 入出庫登録・自分の履歴閲覧 |
| manager | worker + 承認・在庫台帳・棚卸・月次レポート |
| admin | 全権限（manager と同等） |

### トランザクション状態遷移

```
[draft] → [pending] → [approved] → [locked]
                ↘
              [returned] → （workerが修正して再提出）
```

---

## 2. 構造的課題一覧

### 🔴 優先度：高（データ整合性リスク）

---

#### 課題1：StockLedger 更新の非原子性

**場所**: `lib/sheets.ts` L974–980

```typescript
if (isNewlyApproved && existingTx) {
  try {
    await updateStockLedgerForApprovedTransaction(existingTx);
  } catch (error) {
    console.error("[StockLedger] Failed to update closing_qty", error);
    // ← エラーを握り潰し、ロールバックしない
  }
}
```

**問題**:
承認処理は「Transactionsのステータスを `approved` に書き換え」と「StockLedgerの closing_qty を更新」の2段階。Google Sheets には DB 的なトランザクション（ACID）がないため、ステータス更新は成功したが closing_qty の更新が失敗した場合、エラーはログに出るだけでロールバックされない。

**結果**: トランザクションは「承認済み」なのに在庫台帳の数字が動かないという不整合が**無言で**発生しうる。

**対処方針（暫定）**: 管理者が定期的に「在庫集計（動的計算値）vs StockLedger.closing_qty」を突き合わせるチェックを実施する。

---

#### 課題2：月次締め後に期首残高（opening_qty）が更新されない

**場所**: `app/api/monthly-report/route.ts` L83–99

月次締め（finalize）処理では:
- Transactions のステータスを `locked` に変更 ✅
- SupplierReports に記録 ✅
- **StockLedger の opening_qty を更新しない** ❌
- **StockLedger の in_qty / out_qty をリセットしない** ❌

**結果**:
在庫台帳画面の「入庫数/出庫数」は Transactions シートから**全期間の approved+locked を再集計**して表示する（`getStockAggregate` の実装）。月が変わっても前月分が積み上がり続け、表示上の期中入出庫数が実態と乖離する。また、期首残高として表示される値は前回手動設定したまま変わらない。

**対処方針（暫定）**:
月次締め後、管理者が直接 StockLedger シートの opening_qty に closing_qty の値をコピーし、in_qty・out_qty・closing_qty を手動リセットする。

---

#### 課題3：在庫台帳の二重管理（計算軸の不一致）

**場所**: `lib/sheets.ts` L999–1047

```typescript
const computedClosing = openingFromLedger + agg.inQty - agg.outQty;
const closingFromLedger = ledger?.closingQty ?? 0;
const closingQty = closingFromLedger ?? computedClosing; // ← 常にclosingFromLedger優先
```

期末残高 (closing_qty) は以下の2経路から来ている：
1. StockLedger.closing_qty（承認時にインクリメンタル更新）
2. opening_qty + 集計された入出庫量（リアルタイム計算）

画面表示では「1」が優先されるが、上記課題1・2のリスクにより「1」が「2」とズレる可能性がある。どちらが正しい値かの判断基準がシステム内に存在しない。

---

### 🟠 優先度：中（スケール・運用リスク）

---

#### 課題4：全シートに 1,000 行ハードコード上限

**場所**: `lib/sheets.ts` 各所

```typescript
range: "Transactions!A1:Z1000"
range: "Users!A1:G1000"
range: "Items!A1:Z1000"
range: "PhysicalCount!A1:J1000"
```

**問題**: 1,001 行目以降のデータは**読み込まれず、エラーも出ない**。データが 1,000 行を超えると新しいデータが処理対象外になる（古いデータは残るが見えない）。

**推定タイムライン**:
- Transactions: 1日5件として約200日（7ヶ月弱）で到達
- PhysicalCount: 品目数 × 月次で到達が早い可能性

**対処方針（暫定）**: 月次締め後に locked 状態のデータを定期的に別シート（アーカイブ）に移動し、アクティブシートの行数を管理する。

---

#### 課題5：ID の衝突リスク（ミリ秒タイムスタンプ）

**場所**: `lib/sheets.ts` L654, L838, L874, L1150, L1267

```typescript
const id = `TRX_${Date.now()}`;   // 例: TRX_1735689600000
const id = `PC_${Date.now()}`;
const id = `DIFF_${Date.now()}`;
```

**問題**: 同一ミリ秒内に複数のリクエストが来た場合、同一IDが生成される。Google Sheets には UNIQUE 制約がないため、重複IDが**無音でシートに書き込まれる**。

**発生条件**: 複数ユーザーが同時に操作した場合（特に棚卸時の一斉入力）。

---

#### 課題6：月次締め（finalize）の冪等性なし

**場所**: `app/api/monthly-report/route.ts` L83–98

同じ月に finalize を2回実行すると:
- Transactions は既に `locked` のものを再度 `locked` にしようとする（エラーなし）
- SupplierReports に**同じ月のデータが二重登録される**

SupplierReports に対象月のデータが既に存在するかチェックする処理がない。

---

#### 課題7：差し戻し（returned）後の再提出フローが不明確

**問題**:
- 差し戻されたトランザクションは worker が修正可能だが、修正後のステータス変更（returned → pending）を明示的にトリガーする UI/API フローが明確でない。
- Worker がトランザクション編集を行っても、ステータスが `returned` のままになるリスクがある。
- 管理者側の承認キューに再表示されない可能性がある（pending のみを取得するため）。

---

### 🟡 優先度：低（品質・保守性）

---

#### 課題8：DiffLog の期間フィルタが月次レポートにない

**場所**: `app/api/monthly-report/route.ts` L71–78

月次レポート生成時、DiffLog を**全件**取得して対象月の品目に紐づけている。日付フィルタがないため、前月以前の差異ログが今月のレポートに混入する可能性がある。

---

#### 課題9：型定義の二重管理

`Transaction` 型が `lib/sheets.ts`（L37–61）と `types/index.ts`（L79–103）の両方に定義されており、若干の差異（`id` の必須/任意など）がある。将来的に修正が片方だけに行われると乖離が広がる。

---

#### 課題10：本番環境にデバッグログが残存

**場所**: `lib/sheets.ts` L388, L422, L426, L438, L456

```typescript
console.log("[DEBUG sheets] Header:", header);
console.log("[DEBUG sheets] Found row:", ...);
```

`[DEBUG sheets]` プレフィックスのログが本番でも出力され続ける。Vercel のログにユーザー情報（login_id等）が記録される。

---

#### 課題11：README.md とコード実装の不一致

README.md に記載のシートカラム定義（例: Transactions の `slip_photo_url`、`comment` 列）は実装（`sheets.ts` の `TRX_COL` 定義）と一致していない。新規参加者がREADMEを見てシートを作ると動作しない。

---

## 3. スプレッドシート直接編集リスク

スプシの共有設定を緩めている（または緩めていた）期間中、以下の操作が**アプリを介さずに**可能な状態:

| 直接編集の内容 | 影響 |
|---|---|
| Transactions の qty を直接変更 | StockLedger は更新されない → 数量不一致 |
| Transactions の status を直接変更 | 承認フロー・StockLedger更新がスキップされる |
| StockLedger の closing_qty を直接変更 | 在庫台帳表示が意図せず変わる |
| Users の password_hash を直接変更 | 誰でもパスワードを変更可能 |
| 行の削除・挿入 | 行番号ベースの更新処理でデータ破壊の可能性 |

**現時点での確認推奨事項**:
1. スプシの「変更履歴」（Ctrl+Alt+Shift+H）で直接編集の有無を確認する
2. 確認後、共有設定をサービスアカウントのみに制限する

---

## 4. 課題優先度マトリクス

| # | 課題 | 影響度 | 発生頻度 | 対応優先度 |
|---|---|---|---|---|
| 1 | StockLedger非原子更新 | 高 | 低〜中 | **最優先** |
| 2 | 月次締め後の期首未更新 | 高 | 月1回 | **最優先** |
| 3 | 在庫台帳の二重管理 | 中 | 常時 | 高 |
| 4 | 1000行上限 | 高 | 将来的 | 高 |
| 5 | ID衝突 | 中 | 低 | 中 |
| 6 | finalize冪等性 | 中 | 操作ミス時 | 中 |
| 7 | 差し戻し再提出フロー | 低 | 都度 | 中 |
| 8 | DiffLog期間フィルタ | 低 | 月1回 | 低 |
| 9 | 型定義重複 | 低 | 保守時 | 低 |
| 10 | デバッグログ残存 | 低 | 常時 | 低 |
| 11 | README不一致 | 低 | セットアップ時 | 低 |

---

## 5. 当面の暫定運用ルール（コード修正前）

1. **月次締め後の手動作業**: 締め処理実行後、管理者が StockLedger シートの opening_qty を手動更新する
2. **在庫の正確性確認**: 月1回、StockLedger.closing_qty と `在庫台帳` 画面の表示値を突き合わせる
3. **1000行監視**: Transactions シートの行数を月次で確認し、700行を超えたらアーカイブを検討する
4. **finalize の1回限り実施**: 同月の月次締めは1回のみ実行し、誤実行した場合は SupplierReports から重複行を手動削除する
5. **スプシ直接編集の禁止運用化**: 共有設定を元に戻し、編集はアプリ経由のみとする
