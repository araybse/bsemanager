'use client'

import { useState, useEffect, Suspense, useMemo, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  GripVertical,
  Building2,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { InsertTables, Tables, UpdateTables } from '@/lib/types/database'
import { DataQualityReviewSection } from '@/components/settings/data-quality-review-section'
import { CamUtilitiesInputsSection } from '@/components/settings/cam-utilities-inputs-section'
import { CamReconciliationSection } from '@/components/settings/cam-reconciliation-section'
import { ScheduleOfRatesSection } from '@/components/settings/schedule-of-rates-section'
import {
  freshnessBadgeVariant,
  freshnessLabel,
  getFreshnessState,
  type FreshnessState,
} from '@/lib/ops/freshness'

type QBSettings = {
  id: number
  access_token: string
  refresh_token: string
  realm_id: string
  token_expires_at: string
  last_customer_sync_at: string | null
  last_project_sync_at: string | null
  last_invoice_sync_at: string | null
  last_time_sync_at: string | null
  connected_at: string
  updated_at: string
}

type SyncSummary = {
  imported: number
  updated: number
  total: number
}

type TimeSyncSummary = {
  imported: number
  skipped: number
  total: number
}

type SyncResults = {
  customers?: SyncSummary
  projects?: SyncSummary
  invoices?: SyncSummary
  timeEntries?: TimeSyncSummary
}

type SyncRun = {
  id: number
  domain: string
  status: string
  started_at: string
  finished_at: string | null
  imported_count: number
  updated_count: number
  skipped_count: number
  error_count: number
  error_summary: { category?: string; message?: string } | null
}

type DataQualityRun = {
  id: number
  created_at: string
}

type UnmatchedExpense = {
  id: number
  source_entity_type: string | null
  source_entity_id: string | null
  expense_date: string
  vendor_name: string | null
  description: string | null
  fee_amount: number | null
  project_id: number | null
  project_number: string | null
}

type DataQualityChecksResponse = {
  checks: {
    phaseNameMismatches: {
      count: number
      top: Array<{
        project_number: string
        invoice_number: string
        phase_name: string
        amount: number
      }>
    }
    duplicateCostCandidates: {
      count: number
      top: Array<{
        project_number: string
        expense_date: string
        fee_amount: number
        description: string
        row_count: number
        source_types: string[]
      }>
    }
  }
}

type AgencyCatalogRow = {
  id: number
  code: string
  name: string
  sort_order: number | null
  is_active: boolean
}

type PermitCatalogRow = {
  id: number
  agency_id: number
  code: string
  name: string
  description: string | null
  sort_order: number | null
  is_active: boolean
}

type PermitRequiredItemCatalogRow = {
  id: number
  permit_id: number
  code: string
  name: string
  description: string | null
  application_template_id: number | null
  item_type: 'application' | 'document' | 'plan' | 'other'
  responsibility: 'internal' | 'provided' | 'shared'
  default_required: boolean
  sort_order: number | null
  is_active: boolean
}

type ApplicationTemplateRow = {
  id: number
  agency_id: number
  permit_id: number | null
  code: string
  name: string
  storage_bucket: string
  storage_path: string | null
  is_active: boolean
}

type ApplicationFieldMapRow = {
  id: number
  template_id: number
  pdf_field_name: string
  canonical_key: string
  transform_rule: string | null
  fallback_value: string | null
  sort_order: number
}

type ClientRow = Tables<'clients'>

type ProjectInfoFieldOption = {
  label: string
  canonical_key: string
}

type ProjectInfoFieldGroup = {
  title: string
  fields: ProjectInfoFieldOption[]
}

type ProjectInfoSectionCatalogRow = {
  id: number
  code: string
  title: string
  sort_order: number
  is_active: boolean
}

type ProjectInfoFieldCatalogRow = {
  id: number
  section_id: number
  label: string
  description: string | null
  column_name: string
  canonical_key: string
  input_type: 'text' | 'textarea' | 'select' | 'date' | 'phone' | 'number'
  source_type: 'static' | 'project_managers' | 'engineers' | 'city_county' | null
  value_mode: 'scalar' | 'multi'
  sort_order: number
  is_active: boolean
  is_system: boolean
}

type ProjectInfoFieldOptionCatalogRow = {
  id: number
  field_id: number
  label: string
  value: string
  sort_order: number
  is_active: boolean
}

const PROJECT_INFO_FIELD_GROUPS: ProjectInfoFieldGroup[] = [
  {
    title: 'General',
    fields: [
      { label: 'Project Number', canonical_key: 'projectInfo.project_number' },
      { label: 'Project Name', canonical_key: 'projectInfo.project_name' },
      { label: 'Project Manager', canonical_key: 'projectInfo.project_manager' },
      { label: 'Project Engineer', canonical_key: 'projectInfo.project_engineer' },
      { label: 'Client', canonical_key: 'projectInfo.client_name' },
      { label: 'Developer Address (Line 1)', canonical_key: 'projectInfo.client_address_line_1' },
      { label: 'Developer Address (Line 2)', canonical_key: 'projectInfo.client_address_line_2' },
      { label: 'Developer Phone', canonical_key: 'projectInfo.client_phone' },
      { label: 'Project Date', canonical_key: 'projectInfo.project_date' },
      { label: 'Availability #', canonical_key: 'projectInfo.availability_number' },
      { label: 'City/County', canonical_key: 'projectInfo.city_county' },
      { label: 'Engineer Name', canonical_key: 'projectInfo.project_engineer' },
      { label: 'PE #', canonical_key: 'projectInfo.pe_number' },
      { label: 'Engineer Email', canonical_key: 'projectInfo.engineer_email' },
      { label: 'Engineer Phone', canonical_key: 'projectInfo.engineer_phone' },
      { label: 'Date', canonical_key: 'projectInfo.engineer_date' },
      { label: 'Major Access', canonical_key: 'projectInfo.major_access' },
      { label: 'Future Land Use', canonical_key: 'projectInfo.future_land_use' },
      { label: 'Present Use of Property', canonical_key: 'projectInfo.present_use_of_property' },
      { label: 'Building SQFT', canonical_key: 'projectInfo.building_sqft' },
      { label: 'Project Description', canonical_key: 'projectInfo.project_description' },
    ],
  },
  {
    title: 'COJ',
    fields: [
      { label: 'Developer Name', canonical_key: 'projectInfo.developer_name' },
      { label: 'Owner Name', canonical_key: 'projectInfo.owner_name' },
      { label: 'Corporate Title', canonical_key: 'projectInfo.corporate_title' },
      { label: 'Owner Address', canonical_key: 'projectInfo.owner_address' },
      { label: 'Owner # and Street', canonical_key: 'projectInfo.owner_number_and_street' },
      { label: 'Owner City, State, Zip', canonical_key: 'projectInfo.owner_city_state_zip' },
      { label: 'Owner City, State', canonical_key: 'projectInfo.owner_city_state' },
      { label: 'Owner City', canonical_key: 'projectInfo.owner_city' },
      { label: 'Owner State', canonical_key: 'projectInfo.owner_state' },
      { label: 'Owner Zip', canonical_key: 'projectInfo.owner_zip' },
      { label: 'Owner Email', canonical_key: 'projectInfo.owner_email' },
      { label: 'Owner Phone', canonical_key: 'projectInfo.owner_phone' },
      { label: 'Client Phone', canonical_key: 'projectInfo.client_phone' },
      { label: 'Project Name', canonical_key: 'projectInfo.project_name' },
      { label: 'Project Address', canonical_key: 'projectInfo.project_address' },
      { label: 'Project #', canonical_key: 'projectInfo.project_ref_number' },
      { label: 'Project # and Street', canonical_key: 'projectInfo.project_number_and_street' },
      { label: 'Project City, State, Zip', canonical_key: 'projectInfo.project_city_state_zip' },
      {
        label: 'Project Street, City, State, Zip',
        canonical_key: 'projectInfo.project_street_city_state_zip',
      },
      { label: 'Section', canonical_key: 'projectInfo.section' },
      { label: 'Township', canonical_key: 'projectInfo.township' },
      { label: 'Range', canonical_key: 'projectInfo.range' },
      { label: 'Between Streets', canonical_key: 'projectInfo.between_streets' },
      { label: 'Council District', canonical_key: 'projectInfo.council_district' },
      { label: 'Planning District', canonical_key: 'projectInfo.planning_district' },
      { label: 'Census Tract', canonical_key: 'projectInfo.census_tract' },
      { label: 'Zoning', canonical_key: 'projectInfo.zoning' },
      { label: 'PUD Ordinance', canonical_key: 'projectInfo.pud_ordinance' },
      { label: 'Mobility Zone', canonical_key: 'projectInfo.mobility_zone' },
      { label: 'Panel Number', canonical_key: 'projectInfo.panel_number' },
      { label: 'RE Numbers', canonical_key: 'projectInfo.re_numbers' },
      {
        label: 'Transportation Land Use Code',
        canonical_key: 'projectInfo.transportation_land_use_code',
      },
      { label: 'Previous Land Use Code', canonical_key: 'projectInfo.previous_land_use_code' },
      { label: 'Total Land Area', canonical_key: 'projectInfo.total_land_area' },
      { label: 'Developed Land Area', canonical_key: 'projectInfo.developed_land_area' },
      { label: 'Total Units', canonical_key: 'projectInfo.total_units' },
      { label: 'Single Family Units', canonical_key: 'projectInfo.single_family_units' },
      { label: 'Duplex Units', canonical_key: 'projectInfo.duplex_units' },
      { label: 'Apartment Units', canonical_key: 'projectInfo.apartment_units' },
      { label: 'Mobile Home Units', canonical_key: 'projectInfo.mobile_home_units' },
      { label: 'Condo Units', canonical_key: 'projectInfo.condo_units' },
      { label: 'Number of Parking Spaces', canonical_key: 'projectInfo.number_of_parking_spaces' },
      { label: 'Major Access', canonical_key: 'projectInfo.major_access' },
      { label: 'Future Land Use', canonical_key: 'projectInfo.future_land_use' },
      { label: 'Present Use of Property', canonical_key: 'projectInfo.present_use_of_property' },
      { label: 'Building SQFT', canonical_key: 'projectInfo.building_sqft' },
      { label: 'Project Description', canonical_key: 'projectInfo.project_description' },
    ],
  },
  {
    title: 'JEA',
    fields: [
      {
        label: 'JEA Water Construction Permit #',
        canonical_key: 'projectInfo.jea_water_construction_permit_number',
      },
      {
        label: 'JEA Wastewater Construction Permit #',
        canonical_key: 'projectInfo.jea_wastewater_construction_permit_number',
      },
      {
        label: 'JEA Water Construction Permit Date',
        canonical_key: 'projectInfo.jea_water_construction_permit_date',
      },
      {
        label: 'JEA Wastewater Construction Permit Date',
        canonical_key: 'projectInfo.jea_wastewater_construction_permit_date',
      },
      { label: 'Contractor Name', canonical_key: 'projectInfo.contractor_name' },
      { label: 'Contractor Phone', canonical_key: 'projectInfo.contractor_phone' },
      { label: 'Lift Station Address', canonical_key: 'projectInfo.lift_station_address' },
      { label: 'Lift Station Meter Number', canonical_key: 'projectInfo.lift_station_meter_number' },
    ],
  },
  {
    title: 'FDOT',
    fields: [
      { label: 'Permit No.', canonical_key: 'projectInfo.permit_number' },
      { label: 'Section No.', canonical_key: 'projectInfo.section_number' },
      { label: 'State Road', canonical_key: 'projectInfo.state_road' },
      { label: 'County', canonical_key: 'projectInfo.county' },
      {
        label: 'Government Development Review',
        canonical_key: 'projectInfo.government_development_review',
      },
      { label: 'Reviewer Name', canonical_key: 'projectInfo.reviewer_name' },
      { label: 'Reviewer Phone', canonical_key: 'projectInfo.reviewer_phone' },
      { label: 'Reviewer Position', canonical_key: 'projectInfo.reviewer_position' },
      { label: 'Business Type', canonical_key: 'projectInfo.business_type' },
      { label: 'Commercial SQFT', canonical_key: 'projectInfo.commercial_sqft' },
      { label: 'Residential Type', canonical_key: 'projectInfo.residential_type' },
      { label: 'Number of Units', canonical_key: 'projectInfo.number_of_units' },
      { label: 'Daily Traffic Estimate', canonical_key: 'projectInfo.daily_traffic_estimate' },
      { label: 'ITE Land Use Code', canonical_key: 'projectInfo.ite_land_use_code' },
      { label: 'Independent Variables', canonical_key: 'projectInfo.independent_variables' },
      { label: 'ITE Report page # reference', canonical_key: 'projectInfo.ite_report_page_reference' },
      { label: 'Street Name', canonical_key: 'projectInfo.street_name' },
      { label: 'State Road #', canonical_key: 'projectInfo.state_road_number' },
      { label: 'US Highway #', canonical_key: 'projectInfo.us_highway_number' },
      { label: 'Latitude', canonical_key: 'projectInfo.latitude' },
      { label: 'Longitude', canonical_key: 'projectInfo.longitude' },
      { label: 'Benchmark Hor Datum', canonical_key: 'projectInfo.benchmark_hor_datum' },
      { label: 'State Plane Northing', canonical_key: 'projectInfo.state_plane_northing' },
      { label: 'State Plane Easting', canonical_key: 'projectInfo.state_plane_easting' },
      {
        label: 'Desc Of Facility and Connection',
        canonical_key: 'projectInfo.desc_of_facility_and_connection',
      },
      { label: 'Desc For needing permit', canonical_key: 'projectInfo.desc_for_needing_permit' },
    ],
  },
]

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function SettingsContent() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncType, setSyncType] = useState<'all' | 'customers' | 'projects' | 'invoices' | 'time'>('all')
  const [lastSyncResults, setLastSyncResults] = useState<SyncResults | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [editingUser, setEditingUser] = useState<Tables<'profiles'> | null>(null)
  const [resolvingExpenseId, setResolvingExpenseId] = useState<number | null>(null)
  const [expenseProjectSelections, setExpenseProjectSelections] = useState<Record<number, string>>({})
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null)
  const [clientFormData, setClientFormData] = useState({
    name: '',
    address_line_1: '',
    address_line_2: '',
    email: '',
  })
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null)
  const [selectedDocumentAgencyId, setSelectedDocumentAgencyId] = useState<number | null>(null)
  const [selectedPermitId, setSelectedPermitId] = useState<number | null>(null)
  const [newAgencyName, setNewAgencyName] = useState('')
  const [newPermitName, setNewPermitName] = useState('')
  const [newDocumentName, setNewDocumentName] = useState('')
  const [newDocumentType, setNewDocumentType] = useState<'application' | 'document' | 'plan'>('document')
  const [pendingCatalogDelete, setPendingCatalogDelete] = useState<{
    kind: 'agency' | 'permit' | 'document'
    id: number
    label: string
  } | null>(null)
  const [updatingAgencyId, setUpdatingAgencyId] = useState<number | null>(null)
  const [updatingPermitId, setUpdatingPermitId] = useState<number | null>(null)
  const [updatingDocumentId, setUpdatingDocumentId] = useState<number | null>(null)
  const [agencyNameDrafts, setAgencyNameDrafts] = useState<Record<number, string>>({})
  const [permitNameDrafts, setPermitNameDrafts] = useState<Record<number, string>>({})
  const [documentNameDrafts, setDocumentNameDrafts] = useState<Record<number, string>>({})
  const [documentTypeDrafts, setDocumentTypeDrafts] = useState<Record<number, 'application' | 'document' | 'plan'>>({})
  const [documentDescriptionDrafts, setDocumentDescriptionDrafts] = useState<Record<number, string>>({})
  const [uploadingTemplateForDocId, setUploadingTemplateForDocId] = useState<number | null>(null)
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [mappingDialogTemplateId, setMappingDialogTemplateId] = useState<number | null>(null)
  const [mappingDialogLoading, setMappingDialogLoading] = useState(false)
  const [mappingDialogSaving, setMappingDialogSaving] = useState(false)
  const [activePickerPdfFieldName, setActivePickerPdfFieldName] = useState<string | null>(null)
  const [expandedFieldGroups, setExpandedFieldGroups] = useState<Record<string, boolean>>({})
  const [expandedProjectInfoSections, setExpandedProjectInfoSections] = useState<Record<number, boolean>>(
    {}
  )
  const [moveFieldDialogOpen, setMoveFieldDialogOpen] = useState(false)
  const [moveFieldId, setMoveFieldId] = useState<number | null>(null)
  const [moveFieldLabel, setMoveFieldLabel] = useState('')
  const [moveFieldSourceSectionId, setMoveFieldSourceSectionId] = useState<number | null>(null)
  const [moveFieldTargetSectionId, setMoveFieldTargetSectionId] = useState<number | null>(null)
  const [movingField, setMovingField] = useState(false)
  const [draggingProjectInfoField, setDraggingProjectInfoField] = useState<{
    fieldId: number
    sectionId: number
  } | null>(null)
  const [dragOverProjectInfoFieldId, setDragOverProjectInfoFieldId] = useState<number | null>(null)
  const [newProjectInfoSectionTitle, setNewProjectInfoSectionTitle] = useState('')
  const [newFieldLabelBySection, setNewFieldLabelBySection] = useState<Record<number, string>>({})
  const [newFieldDescriptionBySection, setNewFieldDescriptionBySection] = useState<Record<number, string>>({})
  const [newFieldColumnBySection, setNewFieldColumnBySection] = useState<Record<number, string>>({})
  const [newFieldTypeBySection, setNewFieldTypeBySection] = useState<
    Record<number, 'text' | 'textarea' | 'select' | 'date' | 'phone' | 'number'>
  >({})
  const [newFieldValueModeBySection, setNewFieldValueModeBySection] = useState<
    Record<number, 'scalar' | 'multi'>
  >({})
  const [newFieldSourceBySection, setNewFieldSourceBySection] = useState<
    Record<number, 'static' | 'project_managers' | 'engineers' | 'city_county' | ''>
  >({})
  const [newOptionLabelByField, setNewOptionLabelByField] = useState<Record<number, string>>({})
  const [newOptionValueByField, setNewOptionValueByField] = useState<Record<number, string>>({})
  const [templateFieldNames, setTemplateFieldNames] = useState<string[]>([])
  const [mappingDraftsByFieldName, setMappingDraftsByFieldName] = useState<
    Record<string, { canonical_key: string }>
  >({})
  const agencySaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const permitSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const documentSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const documentDescSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const [userForm, setUserForm] = useState({
    full_name: '',
    title: '',
    rate_position_id: '',
    role: 'employee',
    is_active: true,
  })

  // Show toast messages based on URL params
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success === 'connected') {
      toast.success('QuickBooks Time connected successfully!')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_code: 'Authorization failed - no code received',
        token_exchange_failed: 'Failed to exchange authorization code',
        storage_failed: 'Failed to save connection settings',
        unknown: 'An unknown error occurred',
      }
      toast.error(errorMessages[error] || `Connection error: ${error}`)
    }
  }, [searchParams])

  const { data: users, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name')
      if (error) throw error
      return data as Tables<'profiles'>[]
    },
  })

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      return (data || []) as ClientRow[]
    },
  })

  const { data: ratePositions } = useQuery({
    queryKey: ['rate-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_positions')
        .select('id, name, sort_order, is_active')
        .order('sort_order')
      if (error) throw error
      return (data || []) as Array<{ id: number; name: string; is_active: boolean }>
    },
  })

  const ratePositionNameById = useMemo(() => {
    const map = new Map<number, string>()
    ;(ratePositions || []).forEach((position) => map.set(position.id, position.name))
    return map
  }, [ratePositions])

  // Check QB connection status
  const { data: qbSettings, isLoading: loadingQB } = useQuery({
    queryKey: ['qb-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qb_settings')
        .select('*')
        .maybeSingle()
      if (error) {
        console.error('QB settings error:', error)
        return null
      }
      return data as QBSettings | null
    },
  })

  const { data: syncRuns, isLoading: loadingSyncRuns } = useQuery({
    queryKey: ['sync-runs'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select(
          'id, domain, status, started_at, finished_at, imported_count, updated_count, skipped_count, error_count, error_summary'
        )
        .order('started_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data || []) as SyncRun[]
    },
  })

  const { data: lastSuccessfulSyncAt } = useQuery({
    queryKey: ['last-successful-sync-at'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select('finished_at')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return ((data as { finished_at: string | null } | null)?.finished_at || null) as string | null
    },
  })

  const { data: lastSuccessfulDataQualityRunAt } = useQuery({
    queryKey: ['last-successful-data-quality-run-at'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_quality_runs')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return ((data as DataQualityRun | null)?.created_at || null) as string | null
    },
  })

  const { data: unmatchedExpenseCount } = useQuery({
    queryKey: ['unmatched-expense-count'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('project_expenses')
        .select('*', { count: 'exact', head: true })
        .is('project_id', null)
        .or('project_number.is.null,project_number.eq.')
      if (error) throw error
      return count || 0
    },
  })

  const { data: unmatchedExpenses } = useQuery({
    queryKey: ['unmatched-expenses'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_expenses')
        .select(
          'id, source_entity_type, source_entity_id, expense_date, vendor_name, description, fee_amount, project_id, project_number'
        )
        .is('project_id', null)
        .or('project_number.is.null,project_number.eq.')
        .order('expense_date', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data || []) as UnmatchedExpense[]
    },
  })

  const { data: linkedExpenses } = useQuery({
    queryKey: ['linked-expenses'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_expenses')
        .select(
          'id, source_entity_type, source_entity_id, expense_date, vendor_name, description, fee_amount, project_id, project_number'
        )
        .not('project_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data || []) as UnmatchedExpense[]
    },
  })

  const { data: dataQualityChecks } = useQuery({
    queryKey: ['data-quality-checks'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const response = await fetch('/api/data-quality/checks')
      if (!response.ok) throw new Error('Failed to load data quality checks')
      return (await response.json()) as DataQualityChecksResponse
    },
  })

  const { data: projectOptions } = useQuery({
    queryKey: ['project-options-for-expense-resolution'],
    enabled: Boolean(qbSettings?.access_token),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number, name')
        .order('project_number', { ascending: true })
      if (error) throw error
      return (data ||
        []) as Array<{ id: number; project_number: string | null; name: string | null }>
    },
  })

  const { data: agencyCatalog } = useQuery({
    queryKey: ['agency-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_catalog' as never)
        .select('id, code, name, sort_order, is_active')
        .eq('is_active' as never, true as never)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return ((data as AgencyCatalogRow[] | null) || []) as AgencyCatalogRow[]
    },
  })

  const { data: permitCatalog } = useQuery({
    queryKey: ['permit-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permit_catalog' as never)
        .select('id, agency_id, code, name, description, sort_order, is_active')
        .eq('is_active' as never, true as never)
        .order('agency_id', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return ((data as PermitCatalogRow[] | null) || []) as PermitCatalogRow[]
    },
  })

  const { data: permitRequiredItemCatalog } = useQuery({
    queryKey: ['permit-required-item-catalog'],
    queryFn: async () => {
      const withDescription = await supabase
        .from('permit_required_item_catalog' as never)
        .select('id, permit_id, code, name, description, item_type, responsibility, default_required, application_template_id, sort_order, is_active')
        .eq('is_active' as never, true as never)
        .order('permit_id', { ascending: true })
        .order('sort_order', { ascending: true })

      if (!withDescription.error) {
        return ((withDescription.data as PermitRequiredItemCatalogRow[] | null) || []) as PermitRequiredItemCatalogRow[]
      }

      const fallback = await supabase
        .from('permit_required_item_catalog' as never)
        .select('id, permit_id, code, name, item_type, responsibility, default_required, application_template_id, sort_order, is_active')
        .eq('is_active' as never, true as never)
        .order('permit_id', { ascending: true })
        .order('sort_order', { ascending: true })
      if (fallback.error) throw fallback.error

      return (((fallback.data as Omit<PermitRequiredItemCatalogRow, 'description'>[] | null) || []).map((row) => ({
        ...row,
        description: null,
      })) as PermitRequiredItemCatalogRow[])
    },
  })

  const { data: templateCatalog } = useQuery({
    queryKey: ['application-template-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_template_catalog' as never)
        .select('id, agency_id, permit_id, code, name, storage_bucket, storage_path, is_active')
        .eq('is_active' as never, true as never)
        .order('name', { ascending: true })
      if (error) throw error
      return ((data as ApplicationTemplateRow[] | null) || []) as ApplicationTemplateRow[]
    },
  })

  const { data: fieldMappings } = useQuery({
    queryKey: ['application-field-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_field_map' as never)
        .select('id, template_id, pdf_field_name, canonical_key, transform_rule, fallback_value, sort_order')
        .order('template_id', { ascending: true })
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data as ApplicationFieldMapRow[] | null) || []) as ApplicationFieldMapRow[]
    },
  })

  const { data: projectInfoSchema } = useQuery({
    queryKey: ['project-info-schema'],
    queryFn: async () => {
      const response = await fetch('/api/project-info/schema')
      const payload = (await response.json()) as {
        sections?: ProjectInfoSectionCatalogRow[]
        fields?: ProjectInfoFieldCatalogRow[]
        options?: ProjectInfoFieldOptionCatalogRow[]
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || 'Failed to load project info schema')
      return {
        sections: payload.sections || [],
        fields: payload.fields || [],
        options: payload.options || [],
      }
    },
  })

  const permitsByAgency = useMemo(() => {
    const map = new Map<number, PermitCatalogRow[]>()
    ;(permitCatalog || []).forEach((permit) => {
      const list = map.get(permit.agency_id) || []
      list.push(permit)
      map.set(permit.agency_id, list)
    })
    return map
  }, [permitCatalog])

  const selectedAgencyPermits = useMemo(() => {
    if (!selectedAgencyId) return []
    return permitsByAgency.get(selectedAgencyId) || []
  }, [permitsByAgency, selectedAgencyId])

  const selectedDocumentAgencyPermits = useMemo(() => {
    if (!selectedDocumentAgencyId) return []
    return permitsByAgency.get(selectedDocumentAgencyId) || []
  }, [permitsByAgency, selectedDocumentAgencyId])

  const selectedPermitDocuments = useMemo(() => {
    if (!selectedPermitId) return []
    return (permitRequiredItemCatalog || []).filter((row) => row.permit_id === selectedPermitId)
  }, [permitRequiredItemCatalog, selectedPermitId])

  const templateById = useMemo(() => {
    const map = new Map<number, ApplicationTemplateRow>()
    ;(templateCatalog || []).forEach((template) => map.set(template.id, template))
    return map
  }, [templateCatalog])

  const mappingCountByTemplateId = useMemo(() => {
    const map = new Map<number, number>()
    ;(fieldMappings || []).forEach((mapping) => {
      map.set(mapping.template_id, (map.get(mapping.template_id) || 0) + 1)
    })
    return map
  }, [fieldMappings])

  const fieldOptionByCanonicalKey = useMemo(() => {
    const map = new Map<string, ProjectInfoFieldOption & { section: string }>()
    const groups = (() => {
      const sections = projectInfoSchema?.sections || []
      const fields = projectInfoSchema?.fields || []
      if (!sections.length || !fields.length) return PROJECT_INFO_FIELD_GROUPS
      return sections
        .filter((section) => section.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((section) => ({
          title: section.title,
          fields: fields
            .filter((field) => field.section_id === section.id && field.is_active)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((field) => ({ label: field.label, canonical_key: field.canonical_key })),
        }))
    })()
    groups.forEach((group) => {
      group.fields.forEach((field) => {
        if (!map.has(field.canonical_key)) {
          map.set(field.canonical_key, { ...field, section: group.title })
        }
      })
    })
    return map
  }, [projectInfoSchema])

  const projectInfoFieldGroups = useMemo(() => {
    const sections = projectInfoSchema?.sections || []
    const fields = projectInfoSchema?.fields || []
    if (!sections.length || !fields.length) return PROJECT_INFO_FIELD_GROUPS
    return sections
      .filter((section) => section.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((section) => ({
        title: section.title,
        fields: fields
          .filter((field) => field.section_id === section.id && field.is_active)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .flatMap((field) => {
            if (field.value_mode !== 'multi') {
              return [{ label: field.label, canonical_key: field.canonical_key }]
            }
            const multiKeys: ProjectInfoFieldOption[] = [
              { label: `${field.label} (Joined, comma)`, canonical_key: `${field.canonical_key}_joined` },
              {
                label: `${field.label} (Joined, newline)`,
                canonical_key: `${field.canonical_key}_joined_newline`,
              },
              { label: `${field.label} (Count)`, canonical_key: `${field.canonical_key}_count` },
            ]
            for (let index = 0; index < 10; index += 1) {
              multiKeys.push({
                label: `${field.label} #${index + 1}`,
                canonical_key: `${field.canonical_key}[${index}]`,
              })
            }
            return multiKeys
          }),
      }))
  }, [projectInfoSchema])

  useEffect(() => {
    setExpandedFieldGroups((prev) => {
      const next = { ...prev }
      projectInfoFieldGroups.forEach((group) => {
        if (!(group.title in next)) next[group.title] = false
      })
      return next
    })
  }, [projectInfoFieldGroups])

  const projectInfoSections = useMemo(
    () =>
      (projectInfoSchema?.sections || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [projectInfoSchema]
  )

  useEffect(() => {
    setExpandedProjectInfoSections((prev) => {
      const next = { ...prev }
      projectInfoSections.forEach((section) => {
        if (!(section.id in next)) next[section.id] = true
      })
      return next
    })
  }, [projectInfoSections])

  const projectInfoFieldsBySection = useMemo(() => {
    const map = new Map<number, ProjectInfoFieldCatalogRow[]>()
    ;(projectInfoSchema?.fields || []).forEach((field) => {
      const list = map.get(field.section_id) || []
      list.push(field)
      map.set(field.section_id, list)
    })
    map.forEach((list, key) => {
      map.set(
        key,
        list
          .slice()
          .sort((a, b) => {
            if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
            const sortDelta = (a.sort_order ?? 0) - (b.sort_order ?? 0)
            if (sortDelta !== 0) return sortDelta
            return a.label.localeCompare(b.label)
          })
      )
    })
    return map
  }, [projectInfoSchema])

  const projectInfoOptionsByField = useMemo(() => {
    const map = new Map<number, ProjectInfoFieldOptionCatalogRow[]>()
    ;(projectInfoSchema?.options || []).forEach((option) => {
      const list = map.get(option.field_id) || []
      list.push(option)
      map.set(option.field_id, list)
    })
    map.forEach((list, key) => {
      map.set(
        key,
        list.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      )
    })
    return map
  }, [projectInfoSchema])

  const saveExpenseProject = async (expense: UnmatchedExpense, nextProjectId: number | null) => {
    const previousProjectId = expense.project_id || null
    const previousProjectNumber = expense.project_number || null
    const nextProject =
      nextProjectId === null
        ? null
        : (projectOptions || []).find((item) => item.id === nextProjectId) || null
    const nextProjectNumber = nextProject?.project_number || null

    if (previousProjectId === nextProjectId) {
      toast.message('No project change to save')
      return
    }

    const action =
      previousProjectId === null && nextProjectId !== null
        ? 'link'
        : previousProjectId !== null && nextProjectId === null
          ? 'unlink'
          : 'reassign'

    setResolvingExpenseId(expense.id)
    const { error } = await supabase
      .from('project_expenses')
      .update({
        project_id: nextProjectId,
        project_number: nextProjectNumber,
      } as never)
      .eq('id' as never, expense.id as never)

    if (error) {
      toast.error(error.message || 'Failed to resolve expense project')
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase.from('project_expense_audit_log').insert({
        expense_id: expense.id,
        source_entity_type: expense.source_entity_type,
        source_entity_id: expense.source_entity_id,
        action,
        old_project_id: previousProjectId,
        old_project_number: previousProjectNumber,
        new_project_id: nextProjectId,
        new_project_number: nextProjectNumber,
        changed_by: user?.id || null,
        changed_by_email: user?.email || null,
      } as never)

      toast.success(action === 'unlink' ? 'Expense unlinked' : 'Expense project saved')
      queryClient.invalidateQueries({ queryKey: ['unmatched-expense-count'] })
      queryClient.invalidateQueries({ queryKey: ['unmatched-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['linked-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['data-quality-checks'] })
      queryClient.invalidateQueries({ queryKey: ['project-multipliers'] })
      setExpenseProjectSelections((prev) => {
        const next = { ...prev }
        delete next[expense.id]
        return next
      })
    }
    setResolvingExpenseId(null)
  }

  const handleConnect = () => {
    // Use the API route to handle OAuth (it has access to server env vars)
    window.location.href = '/api/qb-time/auth'
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks Time?')) return
    
    const { error } = await supabase
      .from('qb_settings')
      .delete()
      .neq('id', 0)
    
    if (error) {
      toast.error('Failed to disconnect')
    } else {
      toast.success('QuickBooks Time disconnected')
      queryClient.invalidateQueries({ queryKey: ['qb-settings'] })
    }
  }

  const openEditUser = (user: Tables<'profiles'>) => {
    setEditingUser(user)
    setUserForm({
      full_name: user.full_name || '',
      title: user.title || '',
      rate_position_id: user.rate_position_id ? String(user.rate_position_id) : '',
      role: user.role || 'employee',
      is_active: user.is_active ?? true,
    })
    setIsEditOpen(true)
  }

  const closeEditUser = () => {
    setIsEditOpen(false)
    setEditingUser(null)
  }

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingUser) return
    setIsSavingUser(true)
    const selectedRatePositionName = userForm.rate_position_id
      ? ratePositions?.find((position) => position.id === Number(userForm.rate_position_id))?.name || null
      : null
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: userForm.full_name.trim(),
        title: selectedRatePositionName || userForm.title.trim() || null,
        rate_position_id: userForm.rate_position_id ? Number(userForm.rate_position_id) : null,
        role: userForm.role as Tables<'profiles'>['role'],
        is_active: userForm.is_active,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id' as never, editingUser.id as never)

    if (error) {
      toast.error(error.message || 'Failed to update user')
    } else {
      toast.success('User updated')
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profiles-for-position-timeline'] })
      closeEditUser()
    }
    setIsSavingUser(false)
  }

  const handleSync = async (type: 'all' | 'customers' | 'projects' | 'invoices' | 'time' = 'all') => {
    setIsSyncing(true)
    setSyncType(type)
    setLastSyncResults(null)
    try {
      const response = await fetch('/api/qb-time/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        if (data.success === false) {
          toast.warning(data.message || 'Sync completed with issues')
        } else {
          toast.success(data.message)
        }
        setLastSyncResults(data.results)
        queryClient.invalidateQueries({ queryKey: ['qb-settings'] })
        queryClient.invalidateQueries({ queryKey: ['sync-runs'] })
        queryClient.invalidateQueries({ queryKey: ['time-entries'] })
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['clients'] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch {
      toast.error('Failed to sync')
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    if (!selectedAgencyId && (agencyCatalog || []).length > 0) {
      setSelectedAgencyId((agencyCatalog || [])[0].id)
    }
  }, [agencyCatalog, selectedAgencyId])

  useEffect(() => {
    if (!selectedDocumentAgencyId && (agencyCatalog || []).length > 0) {
      setSelectedDocumentAgencyId((agencyCatalog || [])[0].id)
    }
  }, [agencyCatalog, selectedDocumentAgencyId])

  useEffect(() => {
    if (!selectedDocumentAgencyId) return
    const permits = selectedDocumentAgencyPermits
    if (!selectedPermitId && permits.length > 0) {
      setSelectedPermitId(permits[0].id)
      return
    }
    if (selectedPermitId && !permits.some((permit) => permit.id === selectedPermitId)) {
      setSelectedPermitId(permits[0]?.id ?? null)
    }
  }, [selectedDocumentAgencyId, selectedDocumentAgencyPermits, selectedPermitId])

  useEffect(() => {
    const next: Record<number, string> = {}
    ;(agencyCatalog || []).forEach((agency) => {
      next[agency.id] = agency.name
    })
    setAgencyNameDrafts(next)
  }, [agencyCatalog])

  useEffect(() => {
    const nameDrafts: Record<number, string> = {}
    selectedAgencyPermits.forEach((permit) => {
      nameDrafts[permit.id] = permit.name
    })
    setPermitNameDrafts(nameDrafts)
  }, [selectedAgencyPermits])

  useEffect(() => {
    const nameDrafts: Record<number, string> = {}
    const typeDrafts: Record<number, 'application' | 'document' | 'plan'> = {}
    const descriptionDrafts: Record<number, string> = {}
    selectedPermitDocuments.forEach((doc) => {
      nameDrafts[doc.id] = doc.name
      descriptionDrafts[doc.id] = doc.description || ''
      typeDrafts[doc.id] = doc.item_type === 'application' || doc.item_type === 'document' || doc.item_type === 'plan' ? doc.item_type : 'document'
    })
    setDocumentNameDrafts(nameDrafts)
    setDocumentDescriptionDrafts(descriptionDrafts)
    setDocumentTypeDrafts(typeDrafts)
  }, [selectedPermitDocuments])

  useEffect(() => {
    return () => {
      Object.values(agencySaveTimers.current).forEach((timer) => clearTimeout(timer))
      Object.values(permitSaveTimers.current).forEach((timer) => clearTimeout(timer))
      Object.values(documentSaveTimers.current).forEach((timer) => clearTimeout(timer))
      Object.values(documentDescSaveTimers.current).forEach((timer) => clearTimeout(timer))
      agencySaveTimers.current = {}
      permitSaveTimers.current = {}
      documentSaveTimers.current = {}
      documentDescSaveTimers.current = {}
    }
  }, [])

  const refreshCatalogQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['agency-catalog'] })
    queryClient.invalidateQueries({ queryKey: ['permit-catalog'] })
    queryClient.invalidateQueries({ queryKey: ['permit-required-item-catalog'] })
  }

  const toCode = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `ITEM_${Date.now()}`

  const addAgency = async () => {
    const name = newAgencyName.trim()
    if (!name) {
      toast.error('Agency name is required')
      return
    }
    const maxSort = Math.max(0, ...((agencyCatalog || []).map((a) => Number(a.sort_order) || 0)))
    const { error } = await supabase.from('agency_catalog' as never).insert({
      code: toCode(name),
      name,
      sort_order: maxSort + 1,
      is_active: true,
    } as never)
    if (error) {
      toast.error(error.message || 'Failed to add agency')
      return
    }
    setNewAgencyName('')
    refreshCatalogQueries()
    toast.success('Agency added')
  }

  const persistAgencyName = async (agencyId: number, rawName: string) => {
    const name = rawName.trim()
    if (!name) {
      toast.error('Agency name cannot be empty')
      return
    }
    setUpdatingAgencyId(agencyId)
    try {
      const { error } = await supabase
        .from('agency_catalog' as never)
        .update({ name, updated_at: new Date().toISOString() } as never)
        .eq('id' as never, agencyId as never)
      if (error) throw error
      refreshCatalogQueries()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update agency')
    } finally {
      setUpdatingAgencyId(null)
    }
  }

  const deleteAgency = async (agencyId: number) => {
    const { error } = await supabase
      .from('permit_required_item_catalog' as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .in(
        'permit_id' as never,
        ((permitCatalog || []).filter((permit) => permit.agency_id === agencyId).map((permit) => permit.id) as never[])
      )
    if (error) {
      toast.error(error.message || 'Failed to remove agency documents')
      return
    }

    const { error: permitError } = await supabase
      .from('permit_catalog' as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq('agency_id' as never, agencyId as never)
    if (permitError) {
      toast.error(permitError.message || 'Failed to remove agency permits')
      return
    }

    const { error: agencyError } = await supabase
      .from('agency_catalog' as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, agencyId as never)
    if (agencyError) {
      toast.error(agencyError.message || 'Failed to remove agency')
      return
    }

    if (selectedAgencyId === agencyId) {
      setSelectedAgencyId(null)
      setSelectedPermitId(null)
    }
    refreshCatalogQueries()
    toast.success('Agency removed')
  }

  const scheduleAgencyNameSave = (agencyId: number, value: string) => {
    if (agencySaveTimers.current[agencyId]) clearTimeout(agencySaveTimers.current[agencyId])
    agencySaveTimers.current[agencyId] = setTimeout(() => {
      void persistAgencyName(agencyId, value)
      delete agencySaveTimers.current[agencyId]
    }, 450)
  }

  const addPermit = async () => {
    if (!selectedAgencyId) {
      toast.error('Select an agency first')
      return
    }
    const name = newPermitName.trim()
    if (!name) {
      toast.error('Permit name is required')
      return
    }
    const maxSort = Math.max(0, ...selectedAgencyPermits.map((p) => Number(p.sort_order) || 0))
    const { error } = await supabase.from('permit_catalog' as never).insert({
      agency_id: selectedAgencyId,
      code: toCode(name),
      name,
      description: null,
      sort_order: maxSort + 1,
      is_active: true,
    } as never)
    if (error) {
      toast.error(error.message || 'Failed to add permit')
      return
    }
    setNewPermitName('')
    refreshCatalogQueries()
    toast.success('Permit added')
  }

  const persistPermit = async (permitId: number, patch: Partial<Pick<PermitCatalogRow, 'name' | 'description'>>) => {
    setUpdatingPermitId(permitId)
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof patch.name === 'string') {
        const name = patch.name.trim()
        if (!name) {
          toast.error('Permit name cannot be empty')
          return
        }
        payload.name = name
      }
      if (typeof patch.description === 'string') payload.description = patch.description.trim() || null
      const { error } = await supabase
        .from('permit_catalog' as never)
        .update(payload as never)
        .eq('id' as never, permitId as never)
      if (error) throw error
      refreshCatalogQueries()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update permit')
    } finally {
      setUpdatingPermitId(null)
    }
  }

  const deletePermit = async (permitId: number) => {
    const { error } = await supabase
      .from('permit_required_item_catalog' as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq('permit_id' as never, permitId as never)
    if (error) {
      toast.error(error.message || 'Failed to remove permit documents')
      return
    }
    const { error: permitError } = await supabase
      .from('permit_catalog' as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, permitId as never)
    if (permitError) {
      toast.error(permitError.message || 'Failed to remove permit')
      return
    }
    if (selectedPermitId === permitId) setSelectedPermitId(null)
    refreshCatalogQueries()
    toast.success('Permit removed')
  }

  const schedulePermitNameSave = (permitId: number, value: string) => {
    if (permitSaveTimers.current[permitId]) clearTimeout(permitSaveTimers.current[permitId])
    permitSaveTimers.current[permitId] = setTimeout(() => {
      void persistPermit(permitId, { name: value })
      delete permitSaveTimers.current[permitId]
    }, 450)
  }

  const addPermitDocument = async () => {
    if (!selectedPermitId) {
      toast.error('Select a permit first')
      return
    }
    const name = newDocumentName.trim()
    if (!name) {
      toast.error('Document name is required')
      return
    }
    const maxSort = Math.max(0, ...selectedPermitDocuments.map((d) => Number(d.sort_order) || 0))
    const { error } = await supabase.from('permit_required_item_catalog' as never).insert({
      permit_id: selectedPermitId,
      code: toCode(name),
      name,
      item_type: newDocumentType,
      responsibility: 'provided',
      default_required: true,
      sort_order: maxSort + 1,
      is_active: true,
    } as never)
    if (error) {
      toast.error(error.message || 'Failed to add permit document')
      return
    }
    setNewDocumentName('')
    setNewDocumentType('document')
    refreshCatalogQueries()
    toast.success('Permit document added')
  }

  const persistPermitDocument = async (
    documentId: number,
    patch: Partial<Pick<PermitRequiredItemCatalogRow, 'name' | 'item_type' | 'description'>>
  ) => {
    setUpdatingDocumentId(documentId)
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof patch.name === 'string') {
        const name = patch.name.trim()
        if (!name) {
          toast.error('Document name cannot be empty')
          return
        }
        payload.name = name
      }
      if (patch.item_type) payload.item_type = patch.item_type
      if (typeof patch.description === 'string') payload.description = patch.description.trim() || null
      const { error } = await supabase
        .from('permit_required_item_catalog' as never)
        .update(payload as never)
        .eq('id' as never, documentId as never)
      if (error) throw error
      refreshCatalogQueries()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update permit document')
    } finally {
      setUpdatingDocumentId(null)
    }
  }

  const deletePermitDocument = async (documentId: number) => {
    const { error } = await supabase
      .from('permit_required_item_catalog' as never)
      .update({ is_active: false, updated_at: new Date().toISOString() } as never)
      .eq('id' as never, documentId as never)
    if (error) {
      toast.error(error.message || 'Failed to remove permit document')
      return
    }
    refreshCatalogQueries()
    toast.success('Permit document removed')
  }

  const confirmCatalogDelete = async () => {
    if (!pendingCatalogDelete) return
    const target = pendingCatalogDelete
    setPendingCatalogDelete(null)
    if (target.kind === 'agency') {
      await deleteAgency(target.id)
      return
    }
    if (target.kind === 'permit') {
      await deletePermit(target.id)
      return
    }
    await deletePermitDocument(target.id)
  }

  const scheduleDocumentNameSave = (documentId: number, value: string) => {
    if (documentSaveTimers.current[documentId]) clearTimeout(documentSaveTimers.current[documentId])
    documentSaveTimers.current[documentId] = setTimeout(() => {
      void persistPermitDocument(documentId, { name: value })
      delete documentSaveTimers.current[documentId]
    }, 400)
  }

  const scheduleDocumentDescriptionSave = (documentId: number, value: string) => {
    if (documentDescSaveTimers.current[documentId]) clearTimeout(documentDescSaveTimers.current[documentId])
    documentDescSaveTimers.current[documentId] = setTimeout(() => {
      void persistPermitDocument(documentId, { description: value })
      delete documentDescSaveTimers.current[documentId]
    }, 400)
  }

  const loadTemplateMappingData = async (templateId: number) => {
    setMappingDialogLoading(true)
    try {
      const fieldsResponse = await fetch(`/api/templates/fields?template_id=${templateId}`)
      const fieldsPayload = (await fieldsResponse.json()) as {
        fields?: string[]
        error?: string
      }
      if (!fieldsResponse.ok) throw new Error(fieldsPayload.error || 'Failed to read template fields')

      const mappingsResponse = await fetch(`/api/templates/mappings?template_id=${templateId}`)
      const mappingsPayload = (await mappingsResponse.json()) as {
        mappings?: Array<{
          pdf_field_name: string
          canonical_key: string
        }>
        error?: string
      }
      if (!mappingsResponse.ok) throw new Error(mappingsPayload.error || 'Failed to load mappings')

      const nextDrafts: Record<string, { canonical_key: string }> = {}
      ;(fieldsPayload.fields || []).forEach((fieldName) => {
        const existing = (mappingsPayload.mappings || []).find((row) => row.pdf_field_name === fieldName)
        nextDrafts[fieldName] = {
          canonical_key: existing?.canonical_key || '',
        }
      })

      setTemplateFieldNames(fieldsPayload.fields || [])
      setMappingDraftsByFieldName(nextDrafts)
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load template mappings')
      setTemplateFieldNames([])
      setMappingDraftsByFieldName({})
    } finally {
      setMappingDialogLoading(false)
    }
  }

  const openMappingDialog = async (doc: PermitRequiredItemCatalogRow) => {
    if (!doc.application_template_id) {
      toast.error('Upload a template first')
      return
    }
    setMappingDialogTemplateId(doc.application_template_id)
    setMappingDialogOpen(true)
    await loadTemplateMappingData(doc.application_template_id)
  }

  const openFieldPicker = (pdfFieldName: string) => {
    setActivePickerPdfFieldName(pdfFieldName)
  }

  const selectFieldForPdfName = (canonicalKey: string) => {
    if (!activePickerPdfFieldName) return
    setMappingDraftsByFieldName((prev) => ({
      ...prev,
      [activePickerPdfFieldName]: { canonical_key: canonicalKey },
    }))
    setActivePickerPdfFieldName(null)
  }

  const uploadTemplate = async (doc: PermitRequiredItemCatalogRow, file: File) => {
    if (doc.item_type !== 'application') {
      toast.error('Templates can only be uploaded for application items')
      return
    }
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      return
    }

    setUploadingTemplateForDocId(doc.id)
    try {
      const formData = new FormData()
      formData.append('requiredItemCatalogId', String(doc.id))
      formData.append('file', file)

      const response = await fetch('/api/templates/upload', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json()) as { templateId?: number; error?: string }
      if (!response.ok || !payload.templateId) {
        throw new Error(payload.error || 'Failed to upload template')
      }

      queryClient.invalidateQueries({ queryKey: ['permit-required-item-catalog'] })
      queryClient.invalidateQueries({ queryKey: ['application-template-catalog'] })
      queryClient.invalidateQueries({ queryKey: ['application-field-mappings'] })
      toast.success('Template uploaded')
      setMappingDialogTemplateId(payload.templateId)
      setMappingDialogOpen(true)
      await loadTemplateMappingData(payload.templateId)
    } catch (error) {
      toast.error((error as Error).message || 'Failed to upload template')
    } finally {
      setUploadingTemplateForDocId(null)
    }
  }

  const saveTemplateMappings = async () => {
    if (!mappingDialogTemplateId) {
      toast.error('No template selected')
      return
    }
    setMappingDialogSaving(true)
    try {
      const mappings = templateFieldNames.map((fieldName, index) => {
        const draft = mappingDraftsByFieldName[fieldName] || {
          canonical_key: '',
        }
        return {
          pdf_field_name: fieldName,
          canonical_key: draft.canonical_key.trim(),
          transform_rule: null,
          fallback_value: null,
          sort_order: index + 1,
        }
      })

      const response = await fetch('/api/templates/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: mappingDialogTemplateId, mappings }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Failed to save mappings')

      queryClient.invalidateQueries({ queryKey: ['application-field-mappings'] })
      toast.success('Template mappings saved')
      setMappingDialogOpen(false)
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save mappings')
    } finally {
      setMappingDialogSaving(false)
    }
  }

  const createProjectInfoSection = async () => {
    const title = newProjectInfoSectionTitle.trim()
    if (!title) {
      toast.error('Enter a section title')
      return
    }
    const response = await fetch('/api/project-info/schema/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error || 'Failed to create section')
      return
    }
    setNewProjectInfoSectionTitle('')
    toast.success('Section created')
    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
  }

  const updateProjectInfoSection = async (
    sectionId: number,
    patch: Partial<Pick<ProjectInfoSectionCatalogRow, 'title' | 'sort_order' | 'is_active'>>
  ) => {
    const response = await fetch('/api/project-info/schema/sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sectionId, ...patch }),
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error || 'Failed to update section')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
  }

  const createProjectInfoField = async (sectionId: number) => {
    const label = (newFieldLabelBySection[sectionId] || '').trim()
    const description = (newFieldDescriptionBySection[sectionId] || '').trim()
    const column_name = (newFieldColumnBySection[sectionId] || '').trim()
    const input_type = newFieldTypeBySection[sectionId] || 'text'
    const value_mode = newFieldValueModeBySection[sectionId] || 'scalar'
    const source_type = newFieldSourceBySection[sectionId] || (input_type === 'select' ? 'static' : '')
    if (!label || !column_name) {
      toast.error('Field label and column are required')
      return
    }
    const response = await fetch('/api/project-info/schema/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_id: sectionId,
        label,
        description: description || null,
        column_name,
        input_type,
        value_mode,
        source_type: source_type || null,
      }),
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error || 'Failed to create field')
      return
    }
    setNewFieldLabelBySection((prev) => ({ ...prev, [sectionId]: '' }))
    setNewFieldDescriptionBySection((prev) => ({ ...prev, [sectionId]: '' }))
    setNewFieldColumnBySection((prev) => ({ ...prev, [sectionId]: '' }))
    setNewFieldTypeBySection((prev) => ({ ...prev, [sectionId]: 'text' }))
    setNewFieldValueModeBySection((prev) => ({ ...prev, [sectionId]: 'scalar' }))
    setNewFieldSourceBySection((prev) => ({ ...prev, [sectionId]: '' }))
    toast.success('Field created')
    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
  }

  const updateProjectInfoField = async (
    fieldId: number,
    patch: Partial<
      Pick<
        ProjectInfoFieldCatalogRow,
        | 'label'
        | 'description'
        | 'input_type'
        | 'source_type'
        | 'value_mode'
        | 'sort_order'
        | 'section_id'
        | 'is_active'
      >
    >
  ): Promise<boolean> => {
    const response = await fetch('/api/project-info/schema/fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fieldId, ...patch }),
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error || 'Failed to update field')
      return false
    }
    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
    return true
  }

  const closeMoveFieldDialog = () => {
    setMoveFieldDialogOpen(false)
    setMoveFieldId(null)
    setMoveFieldLabel('')
    setMoveFieldSourceSectionId(null)
    setMoveFieldTargetSectionId(null)
    setMovingField(false)
  }

  const openMoveFieldDialog = (field: ProjectInfoFieldCatalogRow) => {
    setMoveFieldId(field.id)
    setMoveFieldLabel(field.label)
    setMoveFieldSourceSectionId(field.section_id)
    setMoveFieldTargetSectionId(field.section_id)
    setMoveFieldDialogOpen(true)
  }

  const moveProjectInfoField = async () => {
    if (!moveFieldId || !moveFieldTargetSectionId) {
      toast.error('Choose a destination section')
      return
    }
    if (moveFieldTargetSectionId === moveFieldSourceSectionId) {
      toast.error('Select a different section')
      return
    }
    setMovingField(true)
    const success = await updateProjectInfoField(moveFieldId, { section_id: moveFieldTargetSectionId })
    setMovingField(false)
    if (!success) return
    toast.success('Field moved')
    closeMoveFieldDialog()
  }

  const toggleProjectInfoFieldVisibility = async (
    sectionId: number,
    field: ProjectInfoFieldCatalogRow
  ) => {
    if (field.is_active) {
      await updateProjectInfoField(field.id, { is_active: false })
      return
    }

    const sectionFields = projectInfoFieldsBySection.get(sectionId) || []
    const maxVisibleSortOrder = sectionFields
      .filter((row) => row.id !== field.id && row.is_active)
      .reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), 0)

    await updateProjectInfoField(field.id, {
      is_active: true,
      sort_order: maxVisibleSortOrder + 1,
    })
  }

  const reorderProjectInfoFieldWithinSection = async (
    sectionId: number,
    sourceFieldId: number,
    targetFieldId: number
  ) => {
    if (sourceFieldId === targetFieldId) return
    const current = (projectInfoFieldsBySection.get(sectionId) || []).slice()
    const sourceIndex = current.findIndex((field) => field.id === sourceFieldId)
    const targetIndex = current.findIndex((field) => field.id === targetFieldId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const reordered = current.slice()
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const updates = reordered
      .map((field, index) => ({
        id: field.id,
        sort_order: index + 1,
        current_sort_order: Number(field.sort_order || 0),
      }))
      .filter((row) => row.current_sort_order !== row.sort_order)

    if (!updates.length) return

    // Optimistically update local query cache so the new order appears immediately.
    queryClient.setQueryData(
      ['project-info-schema'],
      (
        previous:
          | {
              sections: ProjectInfoSectionCatalogRow[]
              fields: ProjectInfoFieldCatalogRow[]
              options: ProjectInfoFieldOptionCatalogRow[]
            }
          | undefined
      ) => {
        if (!previous) return previous
        const nextFields = previous.fields.map((field) => {
          if (field.section_id !== sectionId) return field
          const update = updates.find((row) => row.id === field.id)
          return update ? { ...field, sort_order: update.sort_order } : field
        })
        return { ...previous, fields: nextFields }
      }
    )

    for (const update of updates) {
      const response = await fetch('/api/project-info/schema/fields', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: update.id, sort_order: update.sort_order }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(payload.error || 'Failed to reorder fields')
        queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
        return
      }
    }

    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
    queryClient.refetchQueries({ queryKey: ['project-info-schema'] })
    toast.success('Field order updated')
  }

  const createProjectInfoOption = async (fieldId: number) => {
    const label = (newOptionLabelByField[fieldId] || '').trim()
    const value = (newOptionValueByField[fieldId] || '').trim()
    if (!label || !value) {
      toast.error('Option label and value are required')
      return
    }
    const response = await fetch('/api/project-info/schema/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_id: fieldId, label, value }),
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error || 'Failed to add option')
      return
    }
    setNewOptionLabelByField((prev) => ({ ...prev, [fieldId]: '' }))
    setNewOptionValueByField((prev) => ({ ...prev, [fieldId]: '' }))
    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
  }

  const deleteProjectInfoOption = async (optionId: number) => {
    const response = await fetch(`/api/project-info/schema/options?id=${optionId}`, {
      method: 'DELETE',
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      toast.error(payload.error || 'Failed to delete option')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['project-info-schema'] })
  }

  const createClientMutation = useMutation({
    mutationFn: async (data: InsertTables<'clients'>) => {
      const { error } = await supabase.from('clients').insert(data as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created successfully')
      setIsClientDialogOpen(false)
      setEditingClient(null)
    },
    onError: (error) => {
      toast.error('Failed to create client: ' + error.message)
    },
  })

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTables<'clients'> }) => {
      const { error } = await supabase.from('clients').update(data as never).eq('id', id as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client updated successfully')
      setIsClientDialogOpen(false)
      setEditingClient(null)
    },
    onError: (error) => {
      toast.error('Failed to update client: ' + error.message)
    },
  })

  const deleteClientMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('clients').delete().eq('id', id as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted successfully')
    },
    onError: (error) => {
      toast.error('Failed to delete client: ' + error.message)
    },
  })

  const openCreateClientDialog = () => {
    setEditingClient(null)
    setClientFormData({
      name: '',
      address_line_1: '',
      address_line_2: '',
      email: '',
    })
    setIsClientDialogOpen(true)
  }

  const openEditClientDialog = (client: ClientRow) => {
    setEditingClient(client)
    setClientFormData({
      name: client.name,
      address_line_1: client.address_line_1 || '',
      address_line_2: client.address_line_2 || '',
      email: client.email || '',
    })
    setIsClientDialogOpen(true)
  }

  const closeClientDialog = () => {
    setIsClientDialogOpen(false)
    setEditingClient(null)
  }

  const handleSubmitClient = (event: FormEvent) => {
    event.preventDefault()
    if (!clientFormData.name.trim()) {
      toast.error('Client name is required')
      return
    }

    const data = {
      name: clientFormData.name.trim(),
      address_line_1: clientFormData.address_line_1.trim() || null,
      address_line_2: clientFormData.address_line_2.trim() || null,
      email: clientFormData.email.trim() || null,
    }

    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data })
    } else {
      createClientMutation.mutate(data)
    }
  }

  const handleDeleteClient = (client: ClientRow) => {
    if (confirm(`Are you sure you want to delete "${client.name}"?`)) {
      deleteClientMutation.mutate(client.id)
    }
  }

  const isClientSubmitting = createClientMutation.isPending || updateClientMutation.isPending

  const isConnected = !!qbSettings?.access_token
  const connectionDate = qbSettings?.connected_at 
    ? new Date(qbSettings.connected_at).toLocaleDateString()
    : null
  const syncFreshness = getFreshnessState(lastSuccessfulSyncAt, 24, 72)
  const dataQualityFreshness = getFreshnessState(lastSuccessfulDataQualityRunAt, 24, 72)
  const freshnessState: FreshnessState =
    syncFreshness === 'critical' || dataQualityFreshness === 'critical'
      ? 'critical'
      : syncFreshness === 'stale' || dataQualityFreshness === 'stale'
        ? 'stale'
        : syncFreshness === 'unknown' || dataQualityFreshness === 'unknown'
          ? 'unknown'
          : 'fresh'
  const selectedSettingsTab = useMemo(() => {
    const requestedTab = searchParams.get('tab')
    const allowedTabs = new Set([
      'users',
      'qbo',
      'schedule-of-rates',
      'rates-matrix',
      'clients',
      'data-quality',
      'project-info',
      'agencies-permits',
    ])
    if (requestedTab && allowedTabs.has(requestedTab)) {
      return requestedTab === 'rates-matrix' ? 'schedule-of-rates' : requestedTab
    }
    return 'users'
  }, [searchParams])

  const selectedDataQualitySection = useMemo(() => {
    const requestedSection = searchParams.get('section')
    const allowedSections = new Set(['review', 'utilities-inputs', 'reconciliation'])
    if (requestedSection && allowedSections.has(requestedSection)) return requestedSection
    return 'review'
  }, [searchParams])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage users and integrations
        </p>
      </div>

      <Tabs key={selectedSettingsTab} defaultValue={selectedSettingsTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="qbo">QBO</TabsTrigger>
          <TabsTrigger value="schedule-of-rates">Schedule of Rates</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
          <TabsTrigger value="project-info">Project Info</TabsTrigger>
          <TabsTrigger value="agencies-permits">Agencies and Permits</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-6">

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>User Management</CardTitle>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
          <CardDescription>
            Manage user accounts and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.rate_position_id
                        ? ratePositionNameById.get(user.rate_position_id) || user.title || '—'
                        : user.title || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'outline' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditUser(user)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the selected user details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="user-full-name">Full Name</Label>
                <Input
                  id="user-full-name"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" value={editingUser?.email || ''} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-title">Position</Label>
                <Select
                  value={userForm.rate_position_id || 'none'}
                  onValueChange={(value) =>
                    setUserForm((prev) => ({
                      ...prev,
                      rate_position_id: value === 'none' ? '' : value,
                      title:
                        value === 'none'
                          ? prev.title
                          : ratePositions?.find((position) => position.id === Number(value))?.name || prev.title,
                    }))
                  }
                >
                  <SelectTrigger id="user-title">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(ratePositions || [])
                      .filter((position) => position.is_active)
                      .map((position) => (
                        <SelectItem key={position.id} value={String(position.id)}>
                          {position.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) => setUserForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="project_manager">Project Manager</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="user-active"
                  checked={userForm.is_active}
                  onCheckedChange={(checked) =>
                    setUserForm((prev) => ({ ...prev, is_active: Boolean(checked) }))
                  }
                />
                <Label htmlFor="user-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditUser}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingUser}>
                {isSavingUser ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </TabsContent>

      {/* QuickBooks Integration */}
      <TabsContent value="qbo">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <CardTitle>QuickBooks Online Integration</CardTitle>
          </div>
          <CardDescription>
            Sync customers, projects, invoices, and time entries from QuickBooks Online
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingQB ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">QuickBooks Online</div>
                    {isConnected && (
                      <Badge variant={freshnessBadgeVariant(freshnessState)}>
                        Ops Freshness: {freshnessLabel(freshnessState)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isConnected 
                      ? `Connected on ${connectionDate}`
                      : 'Not connected'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {isConnected ? (
                  <Button variant="ghost" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleConnect}>
                    Connect QuickBooks
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {isConnected && (
            <div className="space-y-4">
              <div className="text-sm font-medium">Sync Options</div>
              <div className="flex flex-nowrap gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('all')}
                  disabled={isSyncing}
                  className="h-auto py-3 flex-1"
                >
                  {isSyncing && syncType === 'all' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  <div className="flex-1 text-center">
                    <div className="font-medium">Sync All</div>
                    <div className="text-xs text-muted-foreground">
                      {qbSettings?.last_customer_sync_at ||
                      qbSettings?.last_project_sync_at ||
                      qbSettings?.last_invoice_sync_at ||
                      qbSettings?.last_time_sync_at
                        ? new Date(
                            qbSettings?.last_customer_sync_at ||
                              qbSettings?.last_project_sync_at ||
                              qbSettings?.last_invoice_sync_at ||
                              qbSettings?.last_time_sync_at ||
                              ''
                          ).toLocaleString()
                        : 'Not yet'}
                    </div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('customers')}
                  disabled={isSyncing}
                  className="h-auto py-3 flex-1"
                >
                  {isSyncing && syncType === 'customers' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="mr-2 h-4 w-4" />
                  )}
                  <div className="flex-1 text-center">
                    <div className="font-medium">Clients</div>
                    <div className="text-xs text-muted-foreground">
                      {qbSettings?.last_customer_sync_at
                        ? new Date(qbSettings.last_customer_sync_at).toLocaleString()
                        : 'Not yet'}
                    </div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('projects')}
                  disabled={isSyncing}
                  className="h-auto py-3 flex-1"
                >
                  {isSyncing && syncType === 'projects' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  )}
                  <div className="flex-1 text-center">
                    <div className="font-medium">Projects</div>
                    <div className="text-xs text-muted-foreground">
                      {qbSettings?.last_project_sync_at
                        ? new Date(qbSettings.last_project_sync_at).toLocaleString()
                        : 'Not yet'}
                    </div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('invoices')}
                  disabled={isSyncing}
                  className="h-auto py-3 flex-1"
                >
                  {isSyncing && syncType === 'invoices' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <div className="flex-1 text-center">
                    <div className="font-medium">Invoices</div>
                    <div className="text-xs text-muted-foreground">
                      {qbSettings?.last_invoice_sync_at
                        ? new Date(qbSettings.last_invoice_sync_at).toLocaleString()
                        : 'Not yet'}
                    </div>
                  </div>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleSync('time')}
                  disabled={isSyncing}
                  className="h-auto py-3 flex-1"
                >
                  {isSyncing && syncType === 'time' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="flex-1 text-center">
                    <div className="font-medium">Time</div>
                    <div className="text-xs text-muted-foreground">
                      {qbSettings?.last_time_sync_at
                        ? new Date(qbSettings.last_time_sync_at).toLocaleString()
                        : 'Not yet'}
                    </div>
                  </div>
                </Button>
              </div>
              
              {lastSyncResults && (
                <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                  <div className="text-sm font-medium">Last Sync Results</div>
                  {lastSyncResults.customers && (
                    <div className="text-sm">
                      <span className="font-medium">Customers:</span>{' '}
                      {lastSyncResults.customers.imported} imported,{' '}
                      {lastSyncResults.customers.updated} updated{' '}
                      (of {lastSyncResults.customers.total} total)
                    </div>
                  )}
                  {lastSyncResults.projects && (
                    <div className="text-sm">
                      <span className="font-medium">Projects:</span>{' '}
                      {lastSyncResults.projects.imported} imported,{' '}
                      {lastSyncResults.projects.updated} updated{' '}
                      (of {lastSyncResults.projects.total} total)
                    </div>
                  )}
                  {lastSyncResults.invoices && (
                    <div className="text-sm">
                      <span className="font-medium">Invoices:</span>{' '}
                      {lastSyncResults.invoices.imported} imported,{' '}
                      {lastSyncResults.invoices.updated} updated{' '}
                      (of {lastSyncResults.invoices.total} total)
                    </div>
                  )}
                  {lastSyncResults.timeEntries && (
                    <div className="text-sm">
                      <span className="font-medium">Time Entries:</span>{' '}
                      {lastSyncResults.timeEntries.imported} imported,{' '}
                      {lastSyncResults.timeEntries.skipped} skipped{' '}
                      (of {lastSyncResults.timeEntries.total} total)
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border">
                <div className="border-b p-3 text-sm font-medium flex items-center justify-between">
                  <span>Recent Sync Runs</span>
                  <Badge variant={freshnessBadgeVariant(syncFreshness)}>
                    {freshnessLabel(syncFreshness)}
                  </Badge>
                </div>
                {loadingSyncRuns ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map((item) => (
                      <Skeleton key={item} className="h-8 w-full" />
                    ))}
                  </div>
                ) : syncRuns && syncRuns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead className="text-right">Imported</TableHead>
                        <TableHead className="text-right">Updated</TableHead>
                        <TableHead className="text-right">Skipped</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                        <TableHead>Error Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncRuns.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium">{run.domain}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                run.status === 'success'
                                  ? 'outline'
                                  : run.status === 'partial_success'
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(run.started_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">{run.imported_count}</TableCell>
                          <TableCell className="text-right font-mono">{run.updated_count}</TableCell>
                          <TableCell className="text-right font-mono">{run.skipped_count}</TableCell>
                          <TableCell className="text-right font-mono">{run.error_count}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {run.error_summary?.category || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-3 text-sm text-muted-foreground">No sync history yet.</div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium flex items-center justify-between">
                  <span>Data Quality</span>
                  <Badge variant={freshnessBadgeVariant(dataQualityFreshness)}>
                    {freshnessLabel(dataQualityFreshness)}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Unmatched expenses (no linked project):{' '}
                  <span className="font-mono text-foreground">{unmatchedExpenseCount ?? 0}</span>
                </div>
                {unmatchedExpenses && unmatchedExpenses.length > 0 && (
                  <div className="mt-3 rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Assign Project</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatchedExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(expense.expense_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {(expense.source_entity_type || 'unknown') + ':' + (expense.source_entity_id || 'n/a')}
                            </TableCell>
                            <TableCell>{expense.vendor_name || '—'}</TableCell>
                            <TableCell className="max-w-[460px] truncate text-xs text-muted-foreground">
                              {expense.description || '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(expense.fee_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={expenseProjectSelections[expense.id] || ''}
                                  onValueChange={(value) =>
                                    setExpenseProjectSelections((prev) => ({
                                      ...prev,
                                      [expense.id]: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-[220px]">
                                    <SelectValue placeholder="Choose project" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(projectOptions || []).map((project) => (
                                      <SelectItem key={project.id} value={String(project.id)}>
                                        {(project.project_number || 'No #') + ' - ' + (project.name || 'Unnamed')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const selected = expenseProjectSelections[expense.id]
                                    if (!selected) {
                                      toast.error('Choose a project first')
                                      return
                                    }
                                    const nextProjectId = Number(selected)
                                    if (Number.isNaN(nextProjectId)) {
                                      toast.error('Invalid project selection')
                                      return
                                    }
                                    void saveExpenseProject(expense, nextProjectId)
                                  }}
                                  disabled={resolvingExpenseId === expense.id}
                                >
                                  {resolvingExpenseId === expense.id ? 'Saving...' : 'Link'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Phase Name Mismatches
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {dataQualityChecks?.checks.phaseNameMismatches.count ?? 0}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {(dataQualityChecks?.checks.phaseNameMismatches.top || []).slice(0, 3).map((issue, index) => (
                        <div key={`${issue.project_number}-${issue.invoice_number}-${index}`}>
                          {issue.project_number} / {issue.invoice_number} / {issue.phase_name}
                        </div>
                      ))}
                      {(dataQualityChecks?.checks.phaseNameMismatches.top || []).length === 0 && (
                        <div>No mismatches detected.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Duplicate Cost Candidates
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {dataQualityChecks?.checks.duplicateCostCandidates.count ?? 0}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {(dataQualityChecks?.checks.duplicateCostCandidates.top || []).slice(0, 3).map((issue, index) => (
                        <div key={`${issue.project_number}-${issue.expense_date}-${index}`}>
                          {issue.project_number} / {new Date(issue.expense_date).toLocaleDateString()} / $
                          {issue.fee_amount.toFixed(2)}
                        </div>
                      ))}
                      {(dataQualityChecks?.checks.duplicateCostCandidates.top || []).length === 0 && (
                        <div>No duplicate candidates detected.</div>
                      )}
                    </div>
                  </div>
                </div>

                {linkedExpenses && linkedExpenses.length > 0 && (
                  <div className="mt-3 rounded border">
                    <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                      Recently Linked Expenses
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Current Project</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reassign / Unlink</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(expense.expense_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {(expense.source_entity_type || 'unknown') + ':' + (expense.source_entity_id || 'n/a')}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{expense.project_number || '—'}</TableCell>
                            <TableCell>{expense.vendor_name || '—'}</TableCell>
                            <TableCell className="text-right font-mono">
                              ${Number(expense.fee_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={
                                    expenseProjectSelections[expense.id] ||
                                    (expense.project_id ? String(expense.project_id) : '')
                                  }
                                  onValueChange={(value) =>
                                    setExpenseProjectSelections((prev) => ({
                                      ...prev,
                                      [expense.id]: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-[220px]">
                                    <SelectValue placeholder="Choose project" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(projectOptions || []).map((project) => (
                                      <SelectItem key={project.id} value={String(project.id)}>
                                        {(project.project_number || 'No #') + ' - ' + (project.name || 'Unnamed')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const selected =
                                      expenseProjectSelections[expense.id] ||
                                      (expense.project_id ? String(expense.project_id) : '')
                                    if (!selected) {
                                      toast.error('Choose a project first')
                                      return
                                    }
                                    const nextProjectId = Number(selected)
                                    if (Number.isNaN(nextProjectId)) {
                                      toast.error('Invalid project selection')
                                      return
                                    }
                                    void saveExpenseProject(expense, nextProjectId)
                                  }}
                                  disabled={resolvingExpenseId === expense.id}
                                >
                                  {resolvingExpenseId === expense.id ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void saveExpenseProject(expense, null)}
                                  disabled={resolvingExpenseId === expense.id}
                                >
                                  Unlink
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            {isConnected ? (
              <p>
                Select a sync option above to import data from QuickBooks Online.
                Projects are synced from QBO sub-customers (jobs). Data will be matched to existing records by ID or name.
              </p>
            ) : (
              <p>
                Connect your QuickBooks Online account to sync customers, projects, invoices, and time entries.
                You&apos;ll be redirected to Intuit to authorize the connection.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="schedule-of-rates" className="space-y-4">
        <ScheduleOfRatesSection />
      </TabsContent>

      <TabsContent value="clients" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Clients</h2>
            <p className="text-sm text-muted-foreground">Manage your client information.</p>
          </div>
          <Button onClick={openCreateClientDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loadingClients ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(clients || []).map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {client.address_line_1 ? (
                          <div className="text-sm">
                            <div>{client.address_line_1}</div>
                            {client.address_line_2 ? <div>{client.address_line_2}</div> : null}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{client.email || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditClientDialog(client)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(clients || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">No clients found</p>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
              <DialogDescription>
                {editingClient
                  ? 'Update the client information below.'
                  : 'Enter the details for the new client.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitClient}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    value={clientFormData.name}
                    onChange={(event) =>
                      setClientFormData((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="e.g., City of Springfield"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-address-line-1">Address Line 1</Label>
                  <Input
                    id="client-address-line-1"
                    value={clientFormData.address_line_1}
                    onChange={(event) =>
                      setClientFormData((prev) => ({ ...prev, address_line_1: event.target.value }))
                    }
                    placeholder="e.g., 123 Main Street"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-address-line-2">Address Line 2</Label>
                  <Input
                    id="client-address-line-2"
                    value={clientFormData.address_line_2}
                    onChange={(event) =>
                      setClientFormData((prev) => ({ ...prev, address_line_2: event.target.value }))
                    }
                    placeholder="e.g., Springfield, IL 62701"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-email">Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={clientFormData.email}
                    onChange={(event) =>
                      setClientFormData((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="e.g., billing@client.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeClientDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isClientSubmitting}>
                  {isClientSubmitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="data-quality" className="space-y-4">
        <Tabs key={selectedDataQualitySection} defaultValue={selectedDataQualitySection} className="space-y-4">
          <TabsList>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="utilities-inputs">CAM Utilities Inputs</TabsTrigger>
            <TabsTrigger value="reconciliation">CAM Reconciliation</TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-4">
            <DataQualityReviewSection />
          </TabsContent>

          <TabsContent value="utilities-inputs" className="space-y-4">
            <CamUtilitiesInputsSection />
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-4">
            <CamReconciliationSection />
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="project-info" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Project Info Schema</CardTitle>
            <CardDescription>
              Manage global sections and fields for Project Info across all projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="New section title"
                value={newProjectInfoSectionTitle}
                onChange={(event) => setNewProjectInfoSectionTitle(event.target.value)}
              />
              <Button className="w-fit justify-self-start" onClick={() => void createProjectInfoSection()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>

            {projectInfoSections.map((section) => {
              const sectionFields = projectInfoFieldsBySection.get(section.id) || []
              const isExpanded = expandedProjectInfoSections[section.id] ?? true
              return (
                <div key={section.id} className="rounded-md border p-3 space-y-3">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-sm font-semibold text-left"
                    onClick={() =>
                      setExpandedProjectInfoSections((prev) => ({
                        ...prev,
                        [section.id]: !isExpanded,
                      }))
                    }
                  >
                    <span>{section.title}</span>
                    <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded ? (
                    <>
                      <div className="grid gap-2 md:grid-cols-[1fr_120px_120px]">
                        <Input
                          defaultValue={section.title}
                          onBlur={(event) => {
                            const next = event.target.value.trim()
                            if (next && next !== section.title) {
                              void updateProjectInfoSection(section.id, { title: next })
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void updateProjectInfoSection(section.id, { is_active: !section.is_active })
                          }
                        >
                          {section.is_active ? 'Hide' : 'Show'}
                        </Button>
                        <Badge variant={section.is_active ? 'outline' : 'secondary'}>
                          {section.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="relative w-full overflow-x-auto">
                        <Table className="table-fixed w-full min-w-[1740px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[44px]"></TableHead>
                              <TableHead className="w-[312px]">Label</TableHead>
                              <TableHead className="w-[421px] min-w-[421px]">Description</TableHead>
                              <TableHead className="w-[258px]">Column</TableHead>
                              <TableHead className="w-[120px]">Mode</TableHead>
                              <TableHead className="w-[166px]">Type</TableHead>
                              <TableHead className="w-[246px]">Source</TableHead>
                              <TableHead className="w-[172px] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                          {sectionFields.map((field) => (
                            <TableRow
                              key={field.id}
                              className={
                                `${!field.is_active ? 'text-muted-foreground ' : ''}${
                                  draggingProjectInfoField?.sectionId === section.id &&
                                  dragOverProjectInfoFieldId === field.id
                                    ? 'bg-muted/60'
                                    : ''
                                }`.trim() || undefined
                              }
                              onDragOver={(event) => {
                                if (
                                  !draggingProjectInfoField ||
                                  draggingProjectInfoField.sectionId !== section.id
                                ) {
                                  return
                                }
                                event.preventDefault()
                                setDragOverProjectInfoFieldId(field.id)
                              }}
                              onDrop={(event) => {
                                event.preventDefault()
                                if (
                                  !draggingProjectInfoField ||
                                  draggingProjectInfoField.sectionId !== section.id
                                ) {
                                  return
                                }
                                void reorderProjectInfoFieldWithinSection(
                                  section.id,
                                  draggingProjectInfoField.fieldId,
                                  field.id
                                )
                                setDraggingProjectInfoField(null)
                                setDragOverProjectInfoFieldId(null)
                              }}
                            >
                              <TableCell>
                                {field.is_active ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 cursor-grab active:cursor-grabbing"
                                    draggable
                                    onDragStart={() =>
                                      setDraggingProjectInfoField({
                                        fieldId: field.id,
                                        sectionId: section.id,
                                      })
                                    }
                                    onDragEnd={() => {
                                      setDraggingProjectInfoField(null)
                                      setDragOverProjectInfoFieldId(null)
                                    }}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                    <span className="sr-only">Reorder field</span>
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Input
                                  defaultValue={field.label}
                                  className={!field.is_active ? 'text-muted-foreground' : undefined}
                                  onBlur={(event) => {
                                    const next = event.target.value.trim()
                                    if (next && next !== field.label) {
                                      void updateProjectInfoField(field.id, { label: next })
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  defaultValue={field.description ?? ''}
                                  className={!field.is_active ? 'text-muted-foreground' : undefined}
                                  onBlur={(event) => {
                                    const next = event.target.value.trim()
                                    if (next !== (field.description ?? '')) {
                                      void updateProjectInfoField(field.id, { description: next || null })
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Input value={field.column_name} disabled />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={field.value_mode || 'scalar'}
                                  onValueChange={(value) =>
                                    void updateProjectInfoField(field.id, {
                                      value_mode: value as ProjectInfoFieldCatalogRow['value_mode'],
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    className={`h-8 ${!field.is_active ? 'text-muted-foreground' : ''}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="scalar">Scalar</SelectItem>
                                    <SelectItem value="multi">Multi</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={field.input_type}
                                  onValueChange={(value) =>
                                    void updateProjectInfoField(field.id, {
                                      input_type: value as ProjectInfoFieldCatalogRow['input_type'],
                                      source_type:
                                        value === 'select'
                                          ? field.source_type || 'static'
                                          : null,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    className={`h-8 ${!field.is_active ? 'text-muted-foreground' : ''}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="textarea">Textarea</SelectItem>
                                    <SelectItem value="select">Select</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {field.input_type === 'select' ? (
                                  <Select
                                    value={field.source_type || 'static'}
                                    onValueChange={(value) =>
                                      void updateProjectInfoField(field.id, {
                                        source_type: value as ProjectInfoFieldCatalogRow['source_type'],
                                      })
                                    }
                                  >
                                    <SelectTrigger
                                      className={`h-8 ${!field.is_active ? 'text-muted-foreground' : ''}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="static">Static</SelectItem>
                                      <SelectItem value="project_managers">Project Managers</SelectItem>
                                      <SelectItem value="engineers">Engineers</SelectItem>
                                      <SelectItem value="city_county">City/County</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-xs text-muted-foreground">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openMoveFieldDialog(field)}
                                  >
                                    Move
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={!field.is_active ? 'text-foreground' : undefined}
                                    onClick={() => void toggleProjectInfoFieldVisibility(section.id, field)}
                                  >
                                    {field.is_active ? 'Hide' : 'Show'}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}

                          <TableRow>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">—</span>
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="New field label"
                                value={newFieldLabelBySection[section.id] || ''}
                                onChange={(event) =>
                                  setNewFieldLabelBySection((prev) => ({
                                    ...prev,
                                    [section.id]: event.target.value,
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Description"
                                value={newFieldDescriptionBySection[section.id] || ''}
                                onChange={(event) =>
                                  setNewFieldDescriptionBySection((prev) => ({
                                    ...prev,
                                    [section.id]: event.target.value,
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="column_name"
                                value={newFieldColumnBySection[section.id] || ''}
                                onChange={(event) =>
                                  setNewFieldColumnBySection((prev) => ({
                                    ...prev,
                                    [section.id]: event.target.value,
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={newFieldValueModeBySection[section.id] || 'scalar'}
                                onValueChange={(value) =>
                                  setNewFieldValueModeBySection((prev) => ({
                                    ...prev,
                                    [section.id]: value as 'scalar' | 'multi',
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scalar">Scalar</SelectItem>
                                  <SelectItem value="multi">Multi</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={newFieldTypeBySection[section.id] || 'text'}
                                onValueChange={(value) =>
                                  setNewFieldTypeBySection((prev) => ({
                                    ...prev,
                                    [section.id]: value as ProjectInfoFieldCatalogRow['input_type'],
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="textarea">Textarea</SelectItem>
                                  <SelectItem value="select">Select</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="phone">Phone</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {(newFieldTypeBySection[section.id] || 'text') === 'select' ? (
                                <Select
                                  value={newFieldSourceBySection[section.id] || 'static'}
                                  onValueChange={(value) =>
                                    setNewFieldSourceBySection((prev) => ({
                                      ...prev,
                                      [section.id]:
                                        value as 'static' | 'project_managers' | 'engineers' | 'city_county',
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="static">Static</SelectItem>
                                    <SelectItem value="project_managers">Project Managers</SelectItem>
                                    <SelectItem value="engineers">Engineers</SelectItem>
                                    <SelectItem value="city_county">City/County</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => void createProjectInfoField(section.id)}>
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {sectionFields
                        .filter((field) => field.input_type === 'select' && field.source_type === 'static')
                        .map((field) => {
                          const options = projectInfoOptionsByField.get(field.id) || []
                          return (
                            <div key={`options-${field.id}`} className="rounded-md border p-3 space-y-2">
                              <div className="text-sm font-medium">{field.label} Options</div>
                              <div className="flex flex-wrap gap-2">
                                {options.map((option) => (
                                  <Button
                                    key={option.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void deleteProjectInfoOption(option.id)}
                                  >
                                    {option.label} ({option.value}) ×
                                  </Button>
                                ))}
                                {options.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">No options yet</span>
                                ) : null}
                              </div>
                              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                                <Input
                                  placeholder="Option label"
                                  value={newOptionLabelByField[field.id] || ''}
                                  onChange={(event) =>
                                    setNewOptionLabelByField((prev) => ({
                                      ...prev,
                                      [field.id]: event.target.value,
                                    }))
                                  }
                                />
                                <Input
                                  placeholder="Option value"
                                  value={newOptionValueByField[field.id] || ''}
                                  onChange={(event) =>
                                    setNewOptionValueByField((prev) => ({
                                      ...prev,
                                      [field.id]: event.target.value,
                                    }))
                                  }
                                />
                                <Button size="sm" onClick={() => void createProjectInfoOption(field.id)}>
                                  Add Option
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                    </>
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Dialog
          open={moveFieldDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeMoveFieldDialog()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move Project Info Field</DialogTitle>
              <DialogDescription>
                Move <span className="font-medium">{moveFieldLabel || 'field'}</span> to another section.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Current section:{' '}
                <span className="font-medium text-foreground">
                  {projectInfoSections.find((section) => section.id === moveFieldSourceSectionId)?.title ||
                    'Unknown'}
                </span>
              </div>
              <div className="space-y-2">
                <Label>Destination section</Label>
                <Select
                  value={moveFieldTargetSectionId ? String(moveFieldTargetSectionId) : ''}
                  onValueChange={(value) => setMoveFieldTargetSectionId(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectInfoSections.map((section) => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {section.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => closeMoveFieldDialog()}>
                Cancel
              </Button>
              <Button
                disabled={
                  movingField ||
                  !moveFieldId ||
                  !moveFieldTargetSectionId ||
                  moveFieldTargetSectionId === moveFieldSourceSectionId
                }
                onClick={() => void moveProjectInfoField()}
              >
                {movingField ? 'Moving...' : 'Move Field'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="agencies-permits" className="space-y-4">
        <Tabs defaultValue="agencies" className="space-y-4">
          <TabsList className="flex w-full">
            <TabsTrigger className="flex-1 justify-center" value="agencies">Agencies</TabsTrigger>
            <TabsTrigger className="flex-1 justify-center" value="permits">Permits</TabsTrigger>
            <TabsTrigger className="flex-1 justify-center" value="permit-documents">Permit Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="agencies">
        <Card>
          <CardHeader>
            <CardTitle>Agencies</CardTitle>
            <CardDescription>
              Manage global agencies used by all users across projects and workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="New agency name"
                value={newAgencyName}
                onChange={(event) => setNewAgencyName(event.target.value)}
              />
              <Button className="w-fit" onClick={() => void addAgency()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Agency
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[130px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(agencyCatalog || []).map((agency) => (
                  <TableRow
                    key={agency.id}
                    className={selectedAgencyId === agency.id ? 'bg-muted/40' : undefined}
                  >
                    <TableCell>
                      <Input
                        value={agencyNameDrafts[agency.id] ?? agency.name}
                        onFocus={() => setSelectedAgencyId(agency.id)}
                        onChange={(event) => {
                          const value = event.target.value
                          setAgencyNameDrafts((prev) => ({ ...prev, [agency.id]: value }))
                          scheduleAgencyNameSave(agency.id, value)
                        }}
                        onBlur={() => void persistAgencyName(agency.id, agencyNameDrafts[agency.id] ?? '')}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setPendingCatalogDelete({
                            kind: 'agency',
                            id: agency.id,
                            label: agency.name,
                          })
                        }
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {updatingAgencyId ? (
              <p className="text-xs text-muted-foreground">Saving agency changes...</p>
            ) : null}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="permits">
        <Card>
          <CardHeader>
            <CardTitle>Permits</CardTitle>
            <CardDescription>
              Manage permits for the selected agency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[260px_1fr_auto]">
              <Select
                value={selectedAgencyId ? String(selectedAgencyId) : ''}
                onValueChange={(value) => setSelectedAgencyId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agency" />
                </SelectTrigger>
                <SelectContent>
                  {(agencyCatalog || []).map((agency) => (
                    <SelectItem key={agency.id} value={String(agency.id)}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="New permit name"
                value={newPermitName}
                onChange={(event) => setNewPermitName(event.target.value)}
              />
              <Button className="w-fit justify-self-start" onClick={() => void addPermit()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Permit
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[130px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedAgencyPermits.map((permit) => (
                  <TableRow
                    key={permit.id}
                    className={selectedPermitId === permit.id ? 'bg-muted/40' : undefined}
                  >
                    <TableCell>
                      <Input
                        value={permitNameDrafts[permit.id] ?? permit.name}
                        onFocus={() => setSelectedPermitId(permit.id)}
                        onChange={(event) => {
                          const value = event.target.value
                          setPermitNameDrafts((prev) => ({ ...prev, [permit.id]: value }))
                          schedulePermitNameSave(permit.id, value)
                        }}
                        onBlur={() => void persistPermit(permit.id, { name: permitNameDrafts[permit.id] ?? '' })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setPendingCatalogDelete({
                            kind: 'permit',
                            id: permit.id,
                            label: permit.name,
                          })
                        }
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {updatingPermitId ? (
              <p className="text-xs text-muted-foreground">Saving permit changes...</p>
            ) : null}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="permit-documents">
        <Card>
          <CardHeader>
            <CardTitle>Permit Documents</CardTitle>
            <CardDescription>
              Manage required documents for the selected permit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Select
                value={selectedDocumentAgencyId ? String(selectedDocumentAgencyId) : ''}
                onValueChange={(value) => setSelectedDocumentAgencyId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agency" />
                </SelectTrigger>
                <SelectContent>
                  {(agencyCatalog || []).map((agency) => (
                    <SelectItem key={agency.id} value={String(agency.id)}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedPermitId ? String(selectedPermitId) : ''}
                onValueChange={(value) => setSelectedPermitId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select permit" />
                </SelectTrigger>
                <SelectContent>
                  {selectedDocumentAgencyPermits.map((permit) => (
                    <SelectItem key={permit.id} value={String(permit.id)}>
                      {permit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
              <Input
                placeholder="New permit document"
                value={newDocumentName}
                onChange={(event) => setNewDocumentName(event.target.value)}
              />
              <Select
                value={newDocumentType}
                onValueChange={(value) => setNewDocumentType(value as 'application' | 'document' | 'plan')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-fit justify-self-start" onClick={() => void addPermitDocument()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Document
              </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[160px]">Type</TableHead>
                  <TableHead className="w-[260px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPermitDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-xs">{doc.sort_order ?? '-'}</TableCell>
                    <TableCell>
                      <Input
                        value={documentNameDrafts[doc.id] ?? doc.name}
                        onChange={(event) => {
                          const value = event.target.value
                          setDocumentNameDrafts((prev) => ({ ...prev, [doc.id]: value }))
                          scheduleDocumentNameSave(doc.id, value)
                        }}
                        onBlur={() =>
                          void persistPermitDocument(doc.id, {
                            name: documentNameDrafts[doc.id] ?? '',
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={documentTypeDrafts[doc.id] ?? 'document'}
                        onValueChange={(value) => {
                          const nextValue = value as 'application' | 'document' | 'plan'
                          setDocumentTypeDrafts((prev) => ({ ...prev, [doc.id]: nextValue }))
                          void persistPermitDocument(doc.id, { item_type: nextValue })
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="application">Application</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="plan">Plan</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {doc.item_type === 'application' ? (
                          <>
                            <span className="self-center text-xs text-muted-foreground">
                              {doc.application_template_id
                                ? `Mapped ${mappingCountByTemplateId.get(doc.application_template_id) || 0}`
                                : 'No template'}
                            </span>
                            <input
                              id={`template-upload-${doc.id}`}
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) {
                                  void uploadTemplate(doc, file)
                                }
                                event.target.value = ''
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={uploadingTemplateForDocId === doc.id}
                              onClick={() =>
                                document.getElementById(`template-upload-${doc.id}`)?.click()
                              }
                            >
                              {uploadingTemplateForDocId === doc.id ? 'Uploading...' : 'Upload'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!doc.application_template_id}
                              onClick={() => void openMappingDialog(doc)}
                            >
                              {doc.application_template_id
                                ? `Edit Mapping (${mappingCountByTemplateId.get(doc.application_template_id) || 0})`
                                : 'Edit Mapping'}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setPendingCatalogDelete({
                              kind: 'document',
                              id: doc.id,
                              label: doc.name,
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {selectedPermitDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No permit documents found for the selected permit.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            {updatingDocumentId ? (
              <p className="text-xs text-muted-foreground">Saving document changes...</p>
            ) : null}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={Boolean(pendingCatalogDelete)}
          onOpenChange={(open) => {
            if (!open) setPendingCatalogDelete(null)
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
              <DialogDescription>
                {pendingCatalogDelete
                  ? `Delete ${pendingCatalogDelete.label}?`
                  : 'Are you sure you want to delete this item?'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingCatalogDelete(null)}>
                No
              </Button>
              <Button type="button" variant="destructive" onClick={() => void confirmCatalogDelete()}>
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {mappingDialogOpen ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Template Field Mapping</CardTitle>
                  <CardDescription>Map PDF field names to project info canonical keys.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMappingDialogOpen(false)
                      setActivePickerPdfFieldName(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={mappingDialogSaving || !mappingDialogTemplateId}
                    onClick={() => void saveTemplateMappings()}
                  >
                    {mappingDialogSaving ? 'Saving...' : 'Save Mapping'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {mappingDialogTemplateId ? (
                <div className="text-xs text-muted-foreground">
                  Template:{' '}
                  <span className="font-medium text-foreground">
                    {templateById.get(mappingDialogTemplateId)?.name || `#${mappingDialogTemplateId}`}
                  </span>
                </div>
              ) : null}
              {mappingDialogLoading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Loading template fields...</div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div className="rounded-md border overflow-hidden">
                    <div className="max-h-[65vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PDF Field Name</TableHead>
                            <TableHead>Project Info Field</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {templateFieldNames.map((fieldName) => {
                            const draft = mappingDraftsByFieldName[fieldName] || {
                              canonical_key: '',
                            }
                            const selectedField = draft.canonical_key
                              ? fieldOptionByCanonicalKey.get(draft.canonical_key)
                              : null
                            const isActive = activePickerPdfFieldName === fieldName
                            return (
                              <TableRow key={fieldName} className={isActive ? 'bg-muted/40' : undefined}>
                                <TableCell className="font-mono text-xs">{fieldName}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant={isActive ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => openFieldPicker(fieldName)}
                                    >
                                      {selectedField ? selectedField.label : 'Select Field'}
                                    </Button>
                                    <span className="text-xs text-muted-foreground">
                                      {selectedField
                                        ? `${selectedField.section} • ${selectedField.canonical_key}`
                                        : 'Unmapped'}
                                    </span>
                                    {selectedField ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setMappingDraftsByFieldName((prev) => ({
                                            ...prev,
                                            [fieldName]: { canonical_key: '' },
                                          }))
                                        }
                                      >
                                        Clear
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {templateFieldNames.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                                No PDF form fields found on this template.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 flex flex-col">
                    <h3 className="text-sm font-semibold">Select Project Info Field</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      {activePickerPdfFieldName
                        ? `Assign a field to: ${activePickerPdfFieldName}`
                        : 'Select a PDF field row first.'}
                    </p>
                    <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-4">
                      {projectInfoFieldGroups.map((group) => (
                        <div key={group.title} className="rounded-md border p-3 space-y-2">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between text-sm font-semibold text-left"
                            onClick={() =>
                              setExpandedFieldGroups((prev) => ({
                                ...prev,
                                [group.title]: !prev[group.title],
                              }))
                            }
                          >
                            <span>{group.title}</span>
                            <ChevronDown
                              className={`size-4 transition-transform ${
                                expandedFieldGroups[group.title] ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {expandedFieldGroups[group.title] ? (
                            <div className="grid gap-2">
                              {group.fields.map((field) => (
                                <Button
                                  key={`${group.title}-${field.canonical_key}-${field.label}`}
                                  variant="outline"
                                  className="justify-start"
                                  disabled={!activePickerPdfFieldName}
                                  onClick={() => selectFieldForPdfName(field.canonical_key)}
                                >
                                  {field.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        disabled={!activePickerPdfFieldName}
                        onClick={() => {
                          if (!activePickerPdfFieldName) return
                          setMappingDraftsByFieldName((prev) => ({
                            ...prev,
                            [activePickerPdfFieldName]: { canonical_key: '' },
                          }))
                          setActivePickerPdfFieldName(null)
                        }}
                      >
                        Set Unmapped
                      </Button>
                      <Button variant="outline" onClick={() => setActivePickerPdfFieldName(null)}>
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

      </TabsContent>
      </Tabs>
    </div>
  )
}
