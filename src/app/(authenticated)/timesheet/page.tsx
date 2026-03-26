'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function TimesheetPage() {
  const supabase = createClient()
  
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()
      return data
    },
  })

  if (loadingUser || !currentUser) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Timesheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentUser.full_name}
          </p>
        </div>
        <Button>Save</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base font-medium min-w-[220px] text-center">
              Week of Mar 24-30, 2026
            </CardTitle>
            <Button variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Timesheet for {currentUser.full_name} - Building table incrementally...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
