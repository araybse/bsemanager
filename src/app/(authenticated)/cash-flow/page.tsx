'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CashFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Cash Flow</h2>
        <p className="text-sm text-muted-foreground">
          Monthly cash flow projections and actuals
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            The cash flow spreadsheet view will be implemented here with editable cells for each month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page will display a spreadsheet-like grid showing:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
            <li>Income categories (Services, Other Income)</li>
            <li>Expense categories (Payroll, Rent, Insurance, etc.)</li>
            <li>Monthly columns for the year</li>
            <li>Projected vs actual amounts</li>
            <li>Running balance calculations</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
