// 建立或重設登入帳號（直接寫入 TiDB）
//   npm run user:create -- <帳號> <顯示名稱> [admin|staff]
// 密碼用隱藏輸入；自動化時可改設環境變數 CFIS_NEW_PASSWORD。
// 帳號已存在時會更新密碼與名稱。

import { connect } from "@tidbcloud/serverless";
import dotenv from "dotenv";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../lib/auth/password.ts";

dotenv.config({ path: ".dev.vars", quiet: true });

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const [username, displayName, roleArg = "admin"] = process.argv.slice(2);
if (!username || !displayName || !["admin", "staff"].includes(roleArg)) {
  console.error("用法：npm run user:create -- <帳號> <顯示名稱> [admin|staff]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("找不到 DATABASE_URL，請確認 .dev.vars");
  process.exit(1);
}

let password = process.env.CFIS_NEW_PASSWORD ?? "";
if (!password) {
  password = await promptHidden("密碼：");
  const again = await promptHidden("再輸入一次：");
  if (password !== again) {
    console.error("兩次輸入的密碼不一樣");
    process.exit(1);
  }
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`密碼至少 ${MIN_PASSWORD_LENGTH} 個字元`);
  process.exit(1);
}

const conn = connect({ url: process.env.DATABASE_URL });
await conn.execute(
  `INSERT INTO users (username, display_name, password_hash, role)
   VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), password_hash = VALUES(password_hash),
     role = VALUES(role), active = true`,
  [username, displayName, await hashPassword(password), roleArg],
);
console.log(`已建立／更新帳號：${username}（${displayName}，${roleArg}）`);
