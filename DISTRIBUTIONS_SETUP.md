# Distributions Feature - Setup Instructions

## ✅ Code Changes Complete

All code changes for the Distributions row are complete and built successfully:

1. **Database Migration**: `/supabase/migrations/20260403_cash_flow_distributions.sql`
2. **UI Row Added**: Distributions row inserted between "Non-P&L Cash Movement" and "Ending Bank Balance"
3. **Data Integration**: Query fetches distributions, processes them, includes in calculations
4. **Editable Inputs**: Current month + future months have editable inputs
5. **Historical Display**: Past months show historical distribution values
6. **Bank Balance**: Ending bank balance calculation subtracts distributions

---

## 📋 Database Setup Required

**You need to run this SQL in Supabase Dashboard → SQL Editor:**

```sql
-- Create distributions table
CREATE TABLE IF NOT EXISTS cash_flow_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cash_flow_distributions_month ON cash_flow_distributions(month);

-- Enable RLS
ALTER TABLE cash_flow_distributions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to cash_flow_distributions"
  ON cash_flow_distributions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.email = auth.jwt() ->> 'email'
      AND employees.role = 'admin'
    )
  );

-- PM can view
CREATE POLICY "PM can view cash_flow_distributions"
  ON cash_flow_distributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.email = auth.jwt() ->> 'email'
      AND employees.role IN ('admin', 'pm')
    )
  );
```

---

## 🚀 How It Works

### **Current Month (April 2026):**
- Shows **historical value** from database
- Read-only (no input field)
- Shows actual distributions made in April

### **Future Months (May 2026+):**
- Shows **editable input field**
- Type in planned distribution amount
- Auto-saves when you leave the field (onBlur)
- Updates "Ending Bank Balance" immediately

### **Ending Bank Balance Calculation:**
```
Ending Balance = Starting Balance + Net Income - Distributions
```

**Example:**
- Starting Balance: $100,000
- Net Income (May): $50,000
- Distributions (May): $20,000 (you plan to take out)
- **Ending Balance**: $100,000 + $50,000 - $20,000 = **$130,000**

---

## 📊 Where to Find It

**Cash Flow Page:**
1. Go to `/cash-flow`
2. Scroll to bottom of table
3. Find "Non-P&L Cash Movement" row
4. **Distributions** is the indented row below it (pl-8 padding)
5. Click on future month cells to enter planned distributions

---

## 🎨 UI Details

- **Row Style**: Indented (pl-8) under Non-P&L Cash Movement
- **Historical Months**: Display value with red text if negative
- **Current/Future Months**: Number input, 2 decimal places
- **Auto-save**: Updates database when you leave the cell
- **Toast Notification**: "Distribution saved" on success

---

## 🔧 Troubleshooting

**If distributions don't appear:**
1. Check that the table was created (`cash_flow_distributions`)
2. Verify RLS policies are active
3. Check browser console for errors
4. Refresh the page to reload data

**To add test data:**
```sql
INSERT INTO cash_flow_distributions (month, amount)
VALUES ('2026-05', 15000.00);
```

---

## ✨ Next Steps

1. **Run the SQL above** in Supabase Dashboard
2. **Refresh localhost:3000/cash-flow**
3. **Click on May 2026** (or any future month) in the Distributions row
4. **Enter a value** (e.g., 20000)
5. **Click outside the input** → Should save and show toast
6. **Check Ending Bank Balance** → Should reflect the distribution

---

**Status**: ✅ Code complete, ⏳ Database setup needed
