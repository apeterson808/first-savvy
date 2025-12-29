// Base44 Color Palette
export const BASE44_COLORS = {
  softGreen: '#AACC96',
  darkForestGreen: '#25533F',
  peach: '#F4BEAE',
  skyBlue: '#52A5CE',
  pink: '#FF7BAC',
  brown: '#876029',
  burgundy: '#6D1F42',
  lavender: '#D3B6D3',
  yellow: '#EFCE7B',
  lightBlue: '#B8CEE8',
  orange: '#EF6F3C',
  olive: '#AFAB23',
};

export const CHART_COLORS = [
  BASE44_COLORS.skyBlue,
  BASE44_COLORS.softGreen,
  BASE44_COLORS.orange,
  BASE44_COLORS.yellow,
  BASE44_COLORS.pink,
  BASE44_COLORS.peach,
  BASE44_COLORS.lightBlue,
  BASE44_COLORS.lavender,
  BASE44_COLORS.burgundy,
  BASE44_COLORS.brown,
  BASE44_COLORS.olive,
  BASE44_COLORS.darkForestGreen,
];

export function getAccountDisplayName(account) {
  if (!account) return '';
  return account.custom_display_name ||
         account.display_name ||
         account.account_name ||
         account.name ||
         account.account_detail ||
         '';
}