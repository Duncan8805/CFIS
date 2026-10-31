import { paginate } from "@/lib/calc";
import { formatDate, weeklyFieldText } from "@/lib/weekly/fields";
import { fmt, type WRow } from "./weekly-sheet";

// 列印版面：只在列印時出現。照 Excel 週報表的列印模式：
// A4 直印、每頁重複標題、隱藏「公斤」與「濕稻穀折算」，每 26 筆一頁加「本頁小計」（濕稻穀數量），最後加「總合計」。

export function WeeklyPrint({
  rows,
  period,
  vendor,
}: {
  rows: WRow[];
  period: { rocYear: number; term: number };
  vendor: string;
}) {
  // 沒有姓名的列（剛新增還沒填）不印
  const printable = rows.filter((r) => r.row.name.trim());
  if (!printable.length) return null;
  const { pages, totalKg: totalWet } = paginate(printable, (r) => r.wetQuantity);

  return (
    <div className="weekly-print hidden print:block">
      {pages.map((page, p) => (
        <section key={p} className="print-page">
          <h1>
            {period.rocYear} 年第 {period.term} 期作民間烘乾業者代農民烘乾繳售公糧周報表
            <small>繳交業者：{vendor}</small>
          </h1>
          <table>
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "29%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>
                  濕穀進儲
                  <br />
                  日期
                </th>
                <th>繳穀農民</th>
                <th>濕稻穀數量</th>
                <th>水分</th>
                <th>
                  預計繳售公
                  <br />
                  糧業者名稱
                </th>
                <th>
                  預定繳售
                  <br />
                  日期
                </th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((r) => (
                <tr key={r.row.entryId}>
                  <td>{formatDate(r.row.intakeDate)}</td>
                  <td>{r.row.name}</td>
                  <td className="num">{fmt(r.wetQuantity)}</td>
                  <td className="num">{r.row.moisture ?? ""}</td>
                  <td>{weeklyFieldText(r.row, "sellTo", r.defaults)}</td>
                  <td>{formatDate(r.row.plannedSellDate)}</td>
                  <td className="small">{weeklyFieldText(r.row, "remark", r.defaults)}</td>
                </tr>
              ))}
              <tr className="total">
                <td />
                <td>本頁小計</td>
                <td className="num">{fmt(page.subtotalKg)}</td>
                <td colSpan={4} />
              </tr>
              {p === pages.length - 1 && (
                <tr className="total">
                  <td />
                  <td>總合計</td>
                  <td className="num">{fmt(totalWet)}</td>
                  <td colSpan={4} />
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
