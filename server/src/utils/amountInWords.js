// Converts a rupee amount into Indian-English words using the Indian
// numbering system (lakh/crore), e.g. 1234567.50 -> "Twelve Lakh Thirty
// Four Thousand Five Hundred Sixty Seven Rupees And Fifty Paise Only".

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n) {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones ? " " + ONES[ones] : ""}`;
}

function threeDigitsToWords(n) {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

// Indian numbering: crore (1,00,00,000) / lakh (1,00,000) / thousand / hundred.
function integerToWords(n) {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));
  return parts.join(" ").trim();
}

/**
 * @param {number|string} amount - rupee amount (may include paise)
 * @returns {string} e.g. "Twelve Thousand Four Hundred Fifty Rupees Only"
 */
export function amountInWords(amount) {
  const value = Math.abs(Number(amount) || 0);
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);

  const rupeeWords = integerToWords(rupees);
  if (paise > 0) {
    const paiseWords = twoDigitsToWords(paise);
    return `${rupeeWords} Rupees And ${paiseWords} Paise Only`;
  }
  return `${rupeeWords} Rupees Only`;
}

export default amountInWords;
