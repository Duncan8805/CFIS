// 中文輸入法常打出全形數字與符號（１２３４、１２．５、－３００、１１／１２），
// 解析數字、日期前先轉成半形，使用者不用切換輸入法。

/**
 * 全形英數與符號（U+FF01–U+FF5E，含０–９、．－，／：＋）轉成對應的半形 ASCII，
 * 全形空白（U+3000）轉成一般空白。其他字（中文、月、日…）不動。
 */
export function toHalfWidth(s: string): string {
  return s.replace(/[！-～　]/g, (ch) =>
    ch === "　" ? " " : String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}
