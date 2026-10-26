3. How to Test Phase 12
Step 1: Run Backend Automated Tests
In your terminal, run the automated test suite for Phase 12:

powershell
cd d:\EquityLensAI\EquitylensAI\EquityLensAI\backend
npx vitest run tests/phase12Compare.test.ts
Expected Result: 14 passed (covering comparison validation, peer discovery, benchmark calculations, historical normalization, AI synthesis, and saved comparison CRUD/isolation).

To run the entire test suite across all 12 phases:

powershell
npx vitest run
Expected Result: 25 test files passed, 214 tests passed.

Step 2: Validate TypeScript and Next.js Build
To verify that all types and routes build with zero warnings or errors:

powershell
# 1. Backend typecheck
cd d:\EquityLensAI\EquitylensAI\EquityLensAI\backend
npm run typecheck
# 2. Frontend typecheck and production build
cd d:\EquityLensAI\EquitylensAI\EquityLensAI\frontend
npm run typecheck
npm run build
Expected Result: Exit code 0, with /compare and /compare/saved listed among the generated routes.

Step 3: Run the Application Locally
Open two terminal windows:

Terminal 1 (Backend):

powershell
cd d:\EquityLensAI\EquitylensAI\EquityLensAI\backend
npm run dev
Terminal 2 (Frontend):

powershell
cd d:\EquityLensAI\EquitylensAI\EquityLensAI\frontend
npm run dev
Step 4: Manual UI Testing Workflow
Launch the Comparison Workbench:
Open your browser to http://localhost:3000/compare.
By default, it will load with TCS and INFY selected.
Inspect the Side-by-Side Comparison Table:
Toggle category tabs: Valuation, Profitability, Growth, Financial Strength, Cash Flow, and Health.
Hover over the ? tooltip next to any metric (e.g. P/E Ratio, Operating Margin) to inspect definition and units.
Note the high/low badges and the — display for missing metrics (verifying data integrity).
Test Verified Peer Discovery:
Click the "✨ Find Peers" button at the top right of the selector.
The flyout will display companies matching the same verified industry (e.g., IT Services) with their match scores and rationales.
Click a suggested peer (e.g., WIPRO or HCLTECH) to add it to the comparison (up to 5 companies).
Test Historical & Normalized Price Charts:
Scroll down to the Historical Trend & Performance Comparison section.
In Stock Performance mode, switch between 1M, 3M, 6M, 1Y, and 5Y intervals.
Hover over the chart to inspect the multi-company tooltip and baseline re-indexed at 100.
Click Financial Trends to view annual progression tables for Revenue, Net Income, Operating Margin, or ROE.
Test Peer Benchmark Cards:
View the benchmark cards showing Peer Median, Mean, Range, Company Rank (#1, #2), and Percentile (75th %tile).
Test AI Comparative Analysis:
Scroll to the Evidence-Grounded AI Comparative Analysis card.
Click "Generate AI Synthesis".
Review the executive synthesis, structured section cards, and verified evidence tags.
Test CSV Export:
Click "📥 Export CSV" at the top right of the workbench.
Confirm that equitylens_company_comparison.csv downloads with all metadata, company rows, and metric values.
Test Saved Comparisons:
Click "💾 Save Set".
Enter a name (e.g., "IT Bluechips") and click Save Configuration.
Click "📁 Saved Sets" in the top navigation or navigate to http://localhost:3000/compare/saved.
Verify that your comparison appears. Click "Duplicate" to test cloning, then click "Open Set →" to reopen it on the workbench.
Test Stock Detail Page Integration:
Navigate to http://localhost:3000/stocks/nse/RELIANCE.
Click the new "⚖️ Compare" button in the stock header.
Verify that it navigates to /compare?symbols=RELIANCE%3ANSE ready for peer comparison.
Step 5: Test via REST API (cURL / Postman)
You can also test the endpoints directly:

bash
# 1. Compare TCS and INFY
curl -X POST http://localhost:4000/api/v1/compare \
  -H "Content-Type: application/json" \
  -d '{"symbols":[{"symbol":"TCS","exchange":"NSE"},{"symbol":"INFY","exchange":"NSE"}],"period":"annual"}'
# 2. Discover Peers for TCS
curl http://localhost:4000/api/v1/compare/peers/TCS?exchange=NSE
# 3. Calculate Peer Benchmarks
curl -X POST http://localhost:4000/api/v1/compare/benchmarks \
  -H "Content-Type: application/json" \
  -d '{"symbols":[{"symbol":"TCS","exchange":"NSE"},{"symbol":"INFY","exchange":"NSE"}],"period":"annual"}'
# 4. Normalized Historical Prices
curl -X POST http://localhost:4000/api/v1/compare/history \
  -H "Content-Type: application/json" \
  -d '{"symbols":[{"symbol":"TCS","exchange":"NSE"},{"symbol":"INFY","exchange":"NSE"}],"interval":"1Y"}'
11:31 PM