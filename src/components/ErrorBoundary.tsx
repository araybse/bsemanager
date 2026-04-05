import React, { Component, ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the whole app.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom error handler
 * ```tsx
 * <ErrorBoundary onError={(error, errorInfo) => {
 *   // Send to Sentry or logging service
 *   console.error('Error caught:', error, errorInfo)
 * }}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error)
      console.error("Component stack:", errorInfo.componentStack)
    }

    // Store error info in state
    this.setState({ errorInfo })

    // Call optional error handler (e.g., for Sentry integration)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    // Call optional reset handler
    this.props.onReset?.()

    // Reset the error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReport = () => {
    const { error, errorInfo } = this.state

    // Create a detailed error report
    const report = `
Error: ${error?.message}
Stack: ${error?.stack}

Component Stack:${errorInfo?.componentStack}

User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
    `.trim()

    // Copy to clipboard
    navigator.clipboard
      .writeText(report)
      .then(() => {
        alert("Error details copied to clipboard. Please share with support.")
      })
      .catch(() => {
        // Fallback: show in console
        console.log("Error Report:\n", report)
        alert("Error details logged to console. Please check the console.")
      })
  }

  render() {
    if (this.state.hasError) {
      // Allow custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>Something went wrong</CardTitle>
                  <CardDescription>
                    The application encountered an unexpected error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm font-medium text-destructive mb-1">
                    {this.state.error.message}
                  </p>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">
                      View stack trace
                    </summary>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
                      {this.state.error.stack}
                    </pre>
                  </details>
                </div>
              )}

              {process.env.NODE_ENV === "production" && (
                <p className="text-sm text-muted-foreground">
                  We apologize for the inconvenience. Please try refreshing the
                  page or contact support if the problem persists.
                </p>
              )}
            </CardContent>

            <CardFooter className="gap-2">
              <Button onClick={this.handleReset} className="flex-1">
                Try Again
              </Button>
              <Button
                onClick={this.handleReport}
                variant="outline"
                className="flex-1"
              >
                Report Issue
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
