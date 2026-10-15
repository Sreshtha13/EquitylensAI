import YahooFinance from 'yahoo-finance2';

// Suppress community survey notices from appearing in server logs
export const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});
