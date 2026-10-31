import { connect } from "@tidbcloud/serverless";
import { drizzle } from "drizzle-orm/tidb-serverless";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

// TiDB Serverless driver 走 HTTP，每個請求建立連線即可，不需要連線池
export function getDb() {
  const client = connect({ url: env.DATABASE_URL });
  return drizzle({ client, schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
