/**
 * Example usage of ErrorBoundary component
 * 
 * This file demonstrates how to:
 * 1. Wrap components with ErrorBoundary
 * 2. Test error boundary with intentional crashes
 * 3. Integrate with error logging
 */

import { useState } from "react"
import ErrorBoundary from "./ErrorBoundary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Example 1: Component that can crash
function BuggyCounter() {
  const [count, setCount] = useState(0)

  if (count === 5) {
    // Intentionally crash when count reaches 5
    throw new Error("💥 Counter crashed at 5!")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buggy Counter (crashes at 5)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-bold">Count: {count}</p>
        <Button onClick={() => setCount(count + 1)}>Increment</Button>
      </CardContent>
    </Card>
  )
}

// Example 2: Wrapped with ErrorBoundary
export function ErrorBoundaryExample() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Protected Component</h2>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            // In production, send to Sentry or logging service
          }}
          onReset={() => {
            // Handle reset
          }}
        >
          <BuggyCounter />
        </ErrorBoundary>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>Try clicking the increment button until it reaches 5.</p>
        <p>The component will crash, but the error boundary will catch it.</p>
      </div>
    </div>
  )
}

// Example 3: Multiple isolated boundaries
export function MultipleErrorBoundariesExample() {
  return (
    <div className="grid grid-cols-2 gap-4 p-8">
      <ErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle>Safe Component 1</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This component works fine</p>
          </CardContent>
        </Card>
      </ErrorBoundary>

      <ErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle>Safe Component 2</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This one too</p>
          </CardContent>
        </Card>
      </ErrorBoundary>

      <ErrorBoundary>
        <BuggyCounter />
      </ErrorBoundary>

      <ErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle>Safe Component 3</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Still working even if others crash</p>
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  )
}

// Example 4: App-level wrapping (most common pattern)
export function AppWithErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Send to error tracking service
        // Sentry.captureException(error, { contexts: { react: errorInfo } })
        console.error("App-level error:", error, errorInfo)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
