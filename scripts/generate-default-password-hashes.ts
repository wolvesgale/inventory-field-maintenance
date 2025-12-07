// scripts/generate-default-password-hashes.ts
// 実行例: npx ts-node scripts/generate-default-password-hashes.ts
// 出力される CSV を Users シートの password_hash 列に貼り付けてください。

import bcrypt from 'bcryptjs';
import { getUsers } from '@/lib/sheets';

async function main() {
  const users = await getUsers();
  const saltRounds = 10;

  for (const user of users) {
    const loginId = user.login_id.trim();
    const hash = await bcrypt.hash(loginId, saltRounds);
    // login_id,password_hash の CSV 形式で出力
    console.log(`${loginId},${hash}`);
  }
}

main().catch((error) => {
  console.error('Failed to generate default password hashes', error);
  process.exit(1);
});
