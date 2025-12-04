import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { addTransaction } from '@/lib/sheets';
import { Transaction, TransactionType } from '@/types';

interface TransactionRequestBody {
  date?: unknown;
  base?: unknown;
  location?: unknown;
  itemName?: unknown;
  itemCode?: unknown;
  quantity?: unknown;
  transactionType?: unknown;
  memo?: unknown;
}

const isTransactionType = (value: unknown): value is TransactionType => {
  return value === 'IN' || value === 'OUT';
};

const buildItemCode = (base: string, location: string): string => {
  const trimmedBase = base.trim();
  const trimmedLocation = location.trim();
  if (trimmedBase && trimmedLocation) {
    return `${trimmedBase} / ${trimmedLocation}`;
  }
  return trimmedBase || trimmedLocation || 'N/A';
};

const buildReason = (
  transactionType: TransactionType,
  base: string,
  location: string,
  memo?: string
): string => {
  const labels: Record<TransactionType, string> = { IN: '入庫', OUT: '出庫' };
  const details = [`種別: ${labels[transactionType]}`, `拠点: ${base}`];
  if (location) {
    details.push(`棚: ${location}`);
  }
  if (memo) {
    details.push(`メモ: ${memo}`);
  }
  return details.join(' | ');
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const area = session.user.area;
    if (!area) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ユーザーに紐づくエリア情報がありません。管理者に連絡してください。',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as TransactionRequestBody;

    // 必須チェック
    if (
      typeof body.date !== 'string' ||
      typeof body.base !== 'string' ||
      typeof body.itemName !== 'string'
    ) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    if (!isTransactionType(body.transactionType)) {
      return NextResponse.json(
        { success: false, error: '取引種別が不正です' },
        { status: 400 }
      );
    }

    const memo = typeof body.memo === 'string' ? body.memo.trim() : undefined;

    const itemCode =
      typeof body.itemCode === 'string' && body.itemCode.trim()
        ? body.itemCode.trim()
        : undefined;

    const quantityValue = Number(body.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue === 0) {
      return NextResponse.json(
        { success: false, error: '数量は0以外の数値を入力してください' },
        { status: 400 }
      );
    }

    const date = body.date.trim();
    const base = body.base.trim();
    const location =
      typeof body.location === 'string' ? body.location.trim() : '';
    const itemName = body.itemName.trim();

    if (!date || !base || !itemName) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    const transactionRecord: Omit<Transaction, 'id'> = {
      item_code: itemCode ?? buildItemCode(base, location),
      item_name: itemName,
      type: body.transactionType,
      qty: quantityValue,
      reason: buildReason(body.transactionType, base, location, memo),
      user_id: session.user.id,
      user_name: session.user.name,
      area,
      date,
      status: 'pending', // 使用申請：必ず pending で登録
    };

    await addTransaction(transactionRecord);

    return NextResponse.json({ success: true, message: '取引を登録しました' });
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json(
      {
        success: false,
        error: '登録処理でエラーが発生しました',
      },
      { status: 500 }
    );
  }
}
