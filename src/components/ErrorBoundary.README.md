# ErrorBoundary Component

A production-ready React Error Boundary component that catches JavaScript errors in child components and displays a user-friendly fallback UI.

## Features

✅ **Crash Protection** - Catches errors in child component tree  
✅ **User-Friendly UI** - Shows helpful error message instead of blank screen  
✅ **Try Again Button** - Allows users to reset and retry  
✅ **Report Issue** - Copies error details to clipboard for support  
✅ **Development Mode** - Shows detailed error info and stack traces  
✅ **Production Mode** - Shows simplified user-friendly messages  
✅ **TypeScript** - Fully typed with proper interfaces  
✅ **shadcn/ui Design** - Uses Card, Button components for consistency  
✅ **Sentry-Ready** - Optional `onError` callback for logging integration  

## Basic Usage

Wrap any component that might throw errors:

```tsx
import ErrorBoundary from "@/components/ErrorBoundary"

function App() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  )
}
```

## Wrap Your Entire App

The most common pattern is to wrap your entire app at the root level:

```tsx
// main.tsx or App.tsx
import ErrorBoundary from "@/components/ErrorBoundary"

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Your routes */}
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}
```

## Multiple Boundaries

Use multiple error boundaries to isolate failures:

```tsx
<ErrorBoundary>
  <MainLayout>
    <ErrorBoundary>
      <Sidebar />
    </ErrorBoundary>
    
    <ErrorBoundary>
      <MainContent />
    </ErrorBoundary>
  </MainLayout>
</ErrorBoundary>
```

This way, if the Sidebar crashes, the MainContent still works.

## With Error Logging (Sentry)

Integrate with Sentry or other logging services:

```tsx
import * as Sentry from "@sentry/react"
import ErrorBoundary from "@/components/ErrorBoundary"

<ErrorBoundary
  onError={(error, errorInfo) => {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })
  }}
>
  <YourComponent />
</ErrorBoundary>
```

## Custom Fallback UI

Provide your own fallback UI:

```tsx
<ErrorBoundary
  fallback={
    <div className="p-8 text-center">
      <h1>Oops! Something broke.</h1>
      <p>We're on it!</p>
    </div>
  }
>
  <YourComponent />
</ErrorBoundary>
```

## Custom Reset Handler

Execute custom logic when user clicks "Try Again":

```tsx
<ErrorBoundary
  onReset={() => {
    // Clear cache, reset state, etc.
    localStorage.clear()
    window.location.href = "/"
  }}
>
  <YourComponent />
</ErrorBoundary>
```

## Props API

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Components to protect with error boundary |
| `fallback` | `ReactNode` | (Optional) Custom error UI to display |
| `onError` | `(error: Error, errorInfo: ErrorInfo) => void` | (Optional) Callback when error is caught (for logging) |
| `onReset` | `() => void` | (Optional) Callback when user clicks "Try Again" |

## What It Catches

✅ Render errors  
✅ Lifecycle method errors  
✅ Constructor errors  
✅ Event handler errors (within React components)  

## What It Doesn't Catch

❌ Event handlers (use try/catch)  
❌ Asynchronous code (setTimeout, promises)  
❌ Server-side rendering errors  
❌ Errors thrown in the error boundary itself  

For async errors, wrap in try/catch:

```tsx
async function handleClick() {
  try {
    await fetchData()
  } catch (error) {
    // Handle error
  }
}
```

## Development vs Production

**Development Mode:**
- Shows full error message
- Displays expandable stack trace
- Logs to console

**Production Mode:**
- Shows generic user-friendly message
- Hides technical details
- Still allows error reporting via clipboard

## Testing

Create a test component to verify error boundary works:

```tsx
function BuggyComponent() {
  const [shouldCrash, setShouldCrash] = useState(false)
  
  if (shouldCrash) {
    throw new Error("💥 Intentional crash for testing")
  }
  
  return (
    <button onClick={() => setShouldCrash(true)}>
      Trigger Error
    </button>
  )
}

// Test it
<ErrorBoundary>
  <BuggyComponent />
</ErrorBoundary>
```

## Next Steps

1. ✅ **Done** - Created ErrorBoundary component
2. 🔄 **TODO** - Wrap app root with ErrorBoundary
3. 🔄 **TODO** - (Optional) Integrate Sentry or logging service
4. 🔄 **TODO** - Add error boundaries around major features

## Future Enhancements

- [ ] Add retry counter (limit retry attempts)
- [ ] Add error recovery strategies per error type
- [ ] Integrate with toast notifications
- [ ] Add telemetry for error tracking
- [ ] Support for error boundary reset keys
