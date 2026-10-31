// 一張收款單（A4 切 6 張，每張 105 × 99mm）。版面照原本的「收款單生產器(新).html」。

export interface ReceiptAccount {
  id: number;
  org: string;
  unitCode: string;
  accountNo: string;
  holder: string;
}

export interface ReceiptData {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  deposit: number | null;
  prepaid: number;
  collect: number | null;
  /** 收 是文字（例如「扣」）時 */
  collectText: string | null;
  interest: number;
  freight: number;
}

// 跟原本的產生器一樣四捨五入到整數、千分位
export const money = (n: number | null) => (n === null ? "" : Math.round(n).toLocaleString("en-US"));

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <span className="cell">
      <span className="v">{value}</span>
      <span className="lbl">{label}</span>
    </span>
  );
}

function Op({ sym }: { sym: string }) {
  return (
    <span className="op">
      <span className="v">{sym}</span>
      <span className="lbl" />
    </span>
  );
}

export function ReceiptSlip({ data, accounts }: { data: ReceiptData; accounts: ReceiptAccount[] }) {
  const collect = data.collectText ?? money(data.collect);
  return (
    <div className="slip">
      <div className="top">
        <div className="name">{data.name}</div>
        <div className="contact">{data.phone}</div>
      </div>
      <div className="addr">{data.address}</div>
      <div className="calc">
        <div>
          <Cell value={money(data.deposit)} label="入簿" />
          <Op sym="-" />
          <Cell value={money(data.prepaid)} label="先付" />
          <Op sym="=" />
          <Cell value={collect} label="收" />
        </div>
        <div>
          <Cell value={money(data.interest)} label="" />
          <Op sym="-" />
          <Cell value={money(data.freight)} label="運費改天入簿" />
          <Op sym="=" />
          <Cell value={money(data.prepaid)} label="先付" />
        </div>
      </div>
      <div className="bottom">
        <div className="accts-front">
          {accounts.map((a) => (
            <span key={a.id} className="acct-item">
              <span className="org">{a.org}</span>
              <span className="line2">
                單位代號：<span className="no">{a.unitCode}</span>
              </span>
              <span className="line2">
                帳號：<span className="no">{a.accountNo}</span>　{a.holder}
              </span>
            </span>
          ))}
        </div>
        <span className="front-shou">收：{collect}</span>
      </div>
    </div>
  );
}
