# Quick Integration Guide

## 🚀 5-Minute Setup

### Step 1: Wrap Your App (App-Level Protection)

**For Next.js App Router** (recommended location):

```tsx
// app/layout.tsx
import ErrorBoundary from "@/components/ErrorBoundary"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            // Optional: Send to Sentry
            console.error("App Error:", error, errorInfo)
          }}
        >
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

**For Next.js Pages Router**:

```tsx
// pages/_app.tsx
import ErrorBoundary from "@/components/ErrorBoundary"
import type { AppProps } from "next/app"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  )
}
```

### Step 2: Test It Works

Create a test page:

```tsx
// app/test-error/page.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function TestErrorPage() {
  const [shouldCrash, setShouldCrash] = useState(false)

  if (shouldCrash) {
    throw new Error("Test error - ErrorBoundary should catch this!")
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Error Boundary Test</h1>
      <Button onClick={() => setShouldCrash(true)}>
        Trigger Error
      </Button>
    </div>
  )
}
```

Visit `/test-error` and click the button. You should see the error boundary UI!

### Step 3: (Optional) Add Sentry

If you want error tracking:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Then update your ErrorBoundary:

```tsx
import * as Sentry from "@sentry/nextjs"

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
  {children}
</ErrorBoundary>
```

---

## 🎯 Advanced: Feature-Level Boundaries

For better fault isolation, add boundaries around major features:

```tsx
// app/dashboard/page.tsx
import ErrorBoundary from "@/components/ErrorBoundary"

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ErrorBoundary>
        <RevenueChart />
      </ErrorBoundary>

      <ErrorBoundary>
        <ProjectsList />
      </ErrorBoundary>

      <ErrorBoundary>
        <RecentActivity />
      </ErrorBoundary>
    </div>
  )
}
```

Now if RevenueChart crashes, the other widgets keep working!

---

## ✅ You're Done!

Your app is now protected from crashes. Error boundaries will:
- ✅ Catch rendering errors
- ✅ Show user-friendly UI
- ✅ Log errors in development
- ✅ Let users retry
- ✅ Keep the rest of the app working

---

## 🐛 Troubleshooting

**"Error boundary not catching errors"**
- Error boundaries only catch errors during render, in lifecycle methods, and in constructors
- They DON'T catch errors in event handlers (use try/catch)
- They DON'T catch async errors (use try/catch)

**"Still seeing blank screen"**
- Check browser console for errors
- Make sure ErrorBoundary is a parent of the crashing component
- Verify the error happened during render (not in useEffect or event handler)

**"Error UI not showing in production"**
- Error boundary works in production, but details are hidden
- Users see generic message
- Full details only show in development

---

Need help? Check `ErrorBoundary.README.md` for full docs!
