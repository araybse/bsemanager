'use client'

import { useMemo, useState, useEffect, Fragment, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, format as formatMonthLabel, subMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatPercent, formatHours } from '@/lib/utils/format'
import { formatDate, formatDateTime } from '@/lib/utils/dates'
import { isInvoiceAdjustmentLabel } from '@/lib/finance/invoice-line-classification'
import {
  isExpenseInvoicedStatus,
  legacyStatusFromBillingStatus,
  normalizeExpenseBillingStatus,
  type ExpenseBillingStatus,
} from '@/lib/finance/expense-billing-status'
import {
  ArrowLeft,
  Pencil,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  X,
} from 'lucide-react'
import Link from 'next/link'
import type { Tables } from '@/lib/types/database'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from 'recharts'

type ProjectWithRelations = Tables<'projects'> & {
  clients: { name: string; address_line_1: string | null; address_line_2: string | null } | null
}

type ProjectExpenseRow = {
  id: number
  vendor_name: string | null
  source_entity_type: string
  source_entity_id: string | null
  qb_vendor_name: string | null
  expense_date: string
  description: string | null
  fee_amount: number
  markup_pct: number
  amount_to_charge: number
  is_reimbursable: boolean
  status: string
  billing_status: string | null
  invoice_number: string | null
  project_number: string | null
  subcontract_contract_id: number | null
  source_active: boolean
}

type SubcontractContractRow = {
  id: number
  project_id: number | null
  project_number: string | null
  vendor_name: string
  description: string | null
  original_amount: number
  start_date: string | null
  end_date: string | null
  status: 'active' | 'closed' | 'cancelled'
  created_at: string
  updated_at: string
}

type ProjectBillablesEntry = {
  id: number
  employee_id: string | null
  employee_name: string
  entry_date: string
  project_number: string
  project_id: number | null
  phase_name: string
  hours: number
  notes: string | null
  hourly_rate: number
  amount: number
  project_name: string
  is_rate_unresolved: boolean
}

type ProjectInfoRow = {
  id: number
  project_id: number
  project_number: string | null
  project_name: string | null
  client_name: string | null
  client_address_line_1: string | null
  client_address_line_2: string | null
  client_phone: string | null
  project_date: string | null
  availability_number: string | null
  project_manager: string | null
  project_engineer: string | null
  city_county: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
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

type ProjectInfoFieldValueRow = {
  id: number
  project_id: number
  field_id: number
  value: string
  sort_order: number
  is_active: boolean
}

type ProjectInfoFieldOptionCatalogRow = {
  id: number
  field_id: number
  label: string
  value: string
  sort_order: number
  is_active: boolean
}

type AgencyCatalogRow = {
  id: number
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

type PermitCatalogRow = {
  id: number
  agency_id: number
  code: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

type ProjectAgencyRow = {
  id: number
  project_id: number
  agency_id: number
  is_selected: boolean
}

type ProjectPermitSelectionRow = {
  id: number
  project_id: number
  project_agency_id: number | null
  permit_id: number
  permit_identifier: string | null
  status: string
  is_selected: boolean
}

type PermitRequiredItemCatalogRow = {
  id: number
  permit_id: number
  code: string
  name: string
  item_type: 'application' | 'document' | 'plan' | 'other'
  responsibility: 'internal' | 'provided' | 'shared'
  default_required: boolean
  application_template_id: number | null
  sort_order: number
}

type ProjectRequiredItemRow = {
  id: number
  project_id: number
  project_permit_selection_id: number
  required_item_catalog_id: number | null
  code: string | null
  name: string
  item_type: 'application' | 'document' | 'plan' | 'other'
  responsibility: 'internal' | 'provided' | 'shared'
  is_required: boolean
  status: string
  source_url: string | null
  output_file_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ApplicationTemplateRow = {
  id: number
  agency_id: number
  permit_id: number | null
  code: string
  name: string
  storage_path: string | null
  is_active: boolean
}

type ApplicationRunRow = {
  id: number
  project_id: number
  project_permit_selection_id: number | null
  required_item_id: number | null
  template_id: number | null
  status: string
  generated_file_url: string | null
  resolved_fields: Record<string, unknown> | null
  created_at: string
  error_message: string | null
}

const PIE_COLORS = ['#000000', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PROJECT_INFO_EXTRA_FIELDS = [
  { column: 'pe_number', label: 'PE #' },
  { column: 'engineer_email', label: 'Engineer Email' },
  { column: 'engineer_phone', label: 'Engineer Phone' },
  { column: 'engineer_date', label: 'Date' },
  { column: 'developer_name', label: 'Developer Name' },
  { column: 'owner_name', label: 'Owner Name' },
  { column: 'corporate_title', label: 'Corporate Title' },
  { column: 'owner_address', label: 'Owner Address' },
  { column: 'owner_number_and_street', label: 'Owner # and Street' },
  { column: 'owner_city_state_zip', label: 'Owner City, State, Zip' },
  { column: 'owner_city_state', label: 'Owner City, State' },
  { column: 'owner_city', label: 'Owner City' },
  { column: 'owner_state', label: 'Owner State' },
  { column: 'owner_zip', label: 'Owner Zip' },
  { column: 'owner_email', label: 'Owner Email' },
  { column: 'owner_phone', label: 'Owner Phone' },
  { column: 'project_address', label: 'Project Address' },
  { column: 'project_ref_number', label: 'Project #' },
  { column: 'project_number_and_street', label: 'Project # and Street' },
  { column: 'project_city_state_zip', label: 'Project City, State, Zip' },
  { column: 'project_street_city_state_zip', label: 'Project Street, City, State, Zip' },
  { column: 'section', label: 'Section' },
  { column: 'township', label: 'Township' },
  { column: 'range', label: 'Range' },
  { column: 'between_streets', label: 'Between Streets' },
  { column: 'council_district', label: 'Council District' },
  { column: 'planning_district', label: 'Planning District' },
  { column: 'census_tract', label: 'Census Tract' },
  { column: 'zoning', label: 'Zoning' },
  { column: 'pud_ordinance', label: 'PUD Ordinance' },
  { column: 'mobility_zone', label: 'Mobility Zone' },
  { column: 'panel_number', label: 'Panel Number' },
  { column: 're_numbers', label: 'RE Numbers' },
  { column: 'transportation_land_use_code', label: 'Transportation Land Use Code' },
  { column: 'previous_land_use_code', label: 'Previous Land Use Code' },
  { column: 'total_land_area', label: 'Total Land Area' },
  { column: 'developed_land_area', label: 'Developed Land Area' },
  { column: 'total_units', label: 'Total Units' },
  { column: 'single_family_units', label: 'Single Family Units' },
  { column: 'duplex_units', label: 'Duplex Units' },
  { column: 'apartment_units', label: 'Apartment Units' },
  { column: 'mobile_home_units', label: 'Mobile Home Units' },
  { column: 'condo_units', label: 'Condo Units' },
  { column: 'number_of_parking_spaces', label: 'Number of Parking Spaces' },
  { column: 'jea_water_construction_permit_number', label: 'JEA Water Construction Permit #' },
  { column: 'jea_wastewater_construction_permit_number', label: 'JEA Wastewater Construction Permit #' },
  { column: 'jea_water_construction_permit_date', label: 'JEA Water Construction Permit Date' },
  {
    column: 'jea_wastewater_construction_permit_date',
    label: 'JEA Wastewater Construction Permit Date',
  },
  { column: 'contractor_name', label: 'Contractor Name' },
  { column: 'contractor_phone', label: 'Contractor Phone' },
  { column: 'lift_station_address', label: 'Lift Station Address' },
  { column: 'lift_station_meter_number', label: 'Lift Station Meter Number' },
  { column: 'major_access', label: 'Major Access' },
  { column: 'future_land_use', label: 'Future Land Use' },
  { column: 'present_use_of_property', label: 'Present Use of Property' },
  { column: 'building_sqft', label: 'Building SQFT' },
  { column: 'project_description', label: 'Project Description' },
  { column: 'permit_number', label: 'Permit No.' },
  { column: 'section_number', label: 'Section No.' },
  { column: 'state_road', label: 'State Road' },
  { column: 'county', label: 'County' },
  { column: 'government_development_review', label: 'Government Development Review' },
  { column: 'reviewer_name', label: 'Reviewer Name' },
  { column: 'reviewer_phone', label: 'Reviewer Phone' },
  { column: 'reviewer_position', label: 'Reviewer Position' },
  { column: 'business_type', label: 'Business Type' },
  { column: 'commercial_sqft', label: 'Commercial SQFT' },
  { column: 'residential_type', label: 'Residential Type' },
  { column: 'number_of_units', label: 'Number of Units' },
  { column: 'daily_traffic_estimate', label: 'Daily Traffic Estimate' },
  { column: 'ite_land_use_code', label: 'ITE Land Use Code' },
  { column: 'independent_variables', label: 'Independent Variables' },
  { column: 'ite_report_page_reference', label: 'ITE Report page # reference' },
  { column: 'street_name', label: 'Street Name' },
  { column: 'state_road_number', label: 'State Road #' },
  { column: 'us_highway_number', label: 'US Highway #' },
  { column: 'latitude', label: 'Latitude' },
  { column: 'longitude', label: 'Longitude' },
  { column: 'benchmark_hor_datum', label: 'Benchmark Hor Datum' },
  { column: 'state_plane_northing', label: 'State Plane Northing' },
  { column: 'state_plane_easting', label: 'State Plane Easting' },
  { column: 'desc_of_facility_and_connection', label: 'Desc Of Facility and Connection' },
  { column: 'desc_for_needing_permit', label: 'Desc For needing permit' },
] as const

const PROJECT_INFO_EXTRA_PHONE_COLUMNS = new Set([
  'engineer_phone',
  'owner_phone',
  'contractor_phone',
  'reviewer_phone',
])

type ProjectInfoGroupedField = {
  label: string
  key: string
}

const PROJECT_INFO_GROUPS: Array<{ title: string; fields: ProjectInfoGroupedField[] }> = [
  {
    title: 'General',
    fields: [
      { label: 'Project Number', key: 'core.projectNumber' },
      { label: 'Project Name', key: 'core.projectName' },
      { label: 'Project Manager', key: 'core.projectManager' },
      { label: 'Engineer Name', key: 'core.projectEngineer' },
      { label: 'Client', key: 'core.client' },
      { label: 'Developer Address (Line 1)', key: 'core.clientAddressLine1' },
      { label: 'Developer Address (Line 2)', key: 'core.clientAddressLine2' },
      { label: 'Developer Phone', key: 'core.clientPhone' },
      { label: 'Project Date', key: 'core.projectDate' },
      { label: 'Availability #', key: 'core.availabilityNumber' },
      { label: 'City/County', key: 'core.cityCounty' },
      { label: 'PE #', key: 'extra.pe_number' },
      { label: 'Engineer Email', key: 'extra.engineer_email' },
      { label: 'Engineer Phone', key: 'extra.engineer_phone' },
      { label: 'Date', key: 'extra.engineer_date' },
      { label: 'Major Access', key: 'extra.major_access' },
      { label: 'Future Land Use', key: 'extra.future_land_use' },
      { label: 'Present Use of Property', key: 'extra.present_use_of_property' },
      { label: 'Building SQFT', key: 'extra.building_sqft' },
      { label: 'Project Description', key: 'extra.project_description' },
    ],
  },
  {
    title: 'COJ',
    fields: [
      { label: 'Developer Name', key: 'extra.developer_name' },
      { label: 'Owner Name', key: 'extra.owner_name' },
      { label: 'Corporate Title', key: 'extra.corporate_title' },
      { label: 'Owner Address', key: 'extra.owner_address' },
      { label: 'Owner # and Street', key: 'extra.owner_number_and_street' },
      { label: 'Owner City, State, Zip', key: 'extra.owner_city_state_zip' },
      { label: 'Owner City, State', key: 'extra.owner_city_state' },
      { label: 'Owner City', key: 'extra.owner_city' },
      { label: 'Owner State', key: 'extra.owner_state' },
      { label: 'Owner Zip', key: 'extra.owner_zip' },
      { label: 'Owner Email', key: 'extra.owner_email' },
      { label: 'Owner Phone', key: 'extra.owner_phone' },
      { label: 'Project Address', key: 'extra.project_address' },
      { label: 'Project #', key: 'extra.project_ref_number' },
      { label: 'Project # and Street', key: 'extra.project_number_and_street' },
      { label: 'Project City, State, Zip', key: 'extra.project_city_state_zip' },
      { label: 'Project Street, City, State, Zip', key: 'extra.project_street_city_state_zip' },
      { label: 'Section', key: 'extra.section' },
      { label: 'Township', key: 'extra.township' },
      { label: 'Range', key: 'extra.range' },
      { label: 'Between Streets', key: 'extra.between_streets' },
      { label: 'Council District', key: 'extra.council_district' },
      { label: 'Planning District', key: 'extra.planning_district' },
      { label: 'Census Tract', key: 'extra.census_tract' },
      { label: 'Zoning', key: 'extra.zoning' },
      { label: 'PUD Ordinance', key: 'extra.pud_ordinance' },
      { label: 'Mobility Zone', key: 'extra.mobility_zone' },
      { label: 'Panel Number', key: 'extra.panel_number' },
      { label: 'RE Numbers', key: 'extra.re_numbers' },
      { label: 'Transportation Land Use Code', key: 'extra.transportation_land_use_code' },
      { label: 'Previous Land Use Code', key: 'extra.previous_land_use_code' },
      { label: 'Total Land Area', key: 'extra.total_land_area' },
      { label: 'Developed Land Area', key: 'extra.developed_land_area' },
      { label: 'Total Units', key: 'extra.total_units' },
      { label: 'Single Family Units', key: 'extra.single_family_units' },
      { label: 'Duplex Units', key: 'extra.duplex_units' },
      { label: 'Apartment Units', key: 'extra.apartment_units' },
      { label: 'Mobile Home Units', key: 'extra.mobile_home_units' },
      { label: 'Condo Units', key: 'extra.condo_units' },
      { label: 'Number of Parking Spaces', key: 'extra.number_of_parking_spaces' },
    ],
  },
  {
    title: 'JEA',
    fields: [
      { label: 'JEA Water Construction Permit #', key: 'extra.jea_water_construction_permit_number' },
      {
        label: 'JEA Wastewater Construction Permit #',
        key: 'extra.jea_wastewater_construction_permit_number',
      },
      { label: 'JEA Water Construction Permit Date', key: 'extra.jea_water_construction_permit_date' },
      {
        label: 'JEA Wastewater Construction Permit Date',
        key: 'extra.jea_wastewater_construction_permit_date',
      },
      { label: 'Contractor Name', key: 'extra.contractor_name' },
      { label: 'Contractor Phone', key: 'extra.contractor_phone' },
      { label: 'Lift Station Address', key: 'extra.lift_station_address' },
      { label: 'Lift Station Meter Number', key: 'extra.lift_station_meter_number' },
    ],
  },
  {
    title: 'FDOT',
    fields: [
      { label: 'Permit No.', key: 'extra.permit_number' },
      { label: 'Section No.', key: 'extra.section_number' },
      { label: 'State Road', key: 'extra.state_road' },
      { label: 'County', key: 'extra.county' },
      { label: 'Government Development Review', key: 'extra.government_development_review' },
      { label: 'Reviewer Name', key: 'extra.reviewer_name' },
      { label: 'Reviewer Phone', key: 'extra.reviewer_phone' },
      { label: 'Reviewer Position', key: 'extra.reviewer_position' },
      { label: 'Business Type', key: 'extra.business_type' },
      { label: 'Commercial SQFT', key: 'extra.commercial_sqft' },
      { label: 'Residential Type', key: 'extra.residential_type' },
      { label: 'Number of Units', key: 'extra.number_of_units' },
      { label: 'Daily Traffic Estimate', key: 'extra.daily_traffic_estimate' },
      { label: 'ITE Land Use Code', key: 'extra.ite_land_use_code' },
      { label: 'Independent Variables', key: 'extra.independent_variables' },
      { label: 'ITE Report page # reference', key: 'extra.ite_report_page_reference' },
      { label: 'Street Name', key: 'extra.street_name' },
      { label: 'State Road #', key: 'extra.state_road_number' },
      { label: 'US Highway #', key: 'extra.us_highway_number' },
      { label: 'Latitude', key: 'extra.latitude' },
      { label: 'Longitude', key: 'extra.longitude' },
      { label: 'Benchmark Hor Datum', key: 'extra.benchmark_hor_datum' },
      { label: 'State Plane Northing', key: 'extra.state_plane_northing' },
      { label: 'State Plane Easting', key: 'extra.state_plane_easting' },
      { label: 'Desc Of Facility and Connection', key: 'extra.desc_of_facility_and_connection' },
      { label: 'Desc For needing permit', key: 'extra.desc_for_needing_permit' },
    ],
  },
]

const buildEmptyExtraProjectInfoForm = () =>
  Object.fromEntries(PROJECT_INFO_EXTRA_FIELDS.map((field) => [field.column, ''])) as Record<
    string,
    string
  >

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const searchParams = useSearchParams()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSavingEdits, setIsSavingEdits] = useState(false)
  const [dragPhaseIndex, setDragPhaseIndex] = useState<number | null>(null)
  const [phaseDrafts, setPhaseDrafts] = useState<
    Array<{
      id?: number
      phase_code: string
      phase_name: string
      billing_type: 'H' | 'L'
      total_fee: string
    }>
  >([])
  const [deletedPhaseIds, setDeletedPhaseIds] = useState<number[]>([])
  const [serviceNames, setServiceNames] = useState<string[]>([])
  const [contractLaborSearch, setContractLaborSearch] = useState('')
  const [contractLaborVendor, setContractLaborVendor] = useState('all')
  const [contractLaborStart, setContractLaborStart] = useState('')
  const [contractLaborEnd, setContractLaborEnd] = useState('')
  const [contractLaborSort, setContractLaborSort] = useState<'vendor' | 'date' | 'amount'>('date')
  const [contractLaborSortDir, setContractLaborSortDir] = useState<'asc' | 'desc'>('desc')
  const [isContractLaborEditOpen, setIsContractLaborEditOpen] = useState(false)
  const [isContractLaborSaving, setIsContractLaborSaving] = useState(false)
  const [isContractLaborDeleting, setIsContractLaborDeleting] = useState(false)
  const [editingContractLabor, setEditingContractLabor] = useState<Tables<'contract_labor'> | null>(null)
  const [contractLaborForm, setContractLaborForm] = useState({
    vendor_name: '',
    payment_date: '',
    description: '',
    amount: '',
    project_number: '',
  })
  const [updatingExpenseId, setUpdatingExpenseId] = useState<number | null>(null)
  const [updatingExpenseChargeId, setUpdatingExpenseChargeId] = useState<number | null>(null)
  const [updatingExpenseContractId, setUpdatingExpenseContractId] = useState<number | null>(null)
  const [expenseChargeDrafts, setExpenseChargeDrafts] = useState<Record<number, string>>({})
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false)
  const [isSavingContract, setIsSavingContract] = useState(false)
  const [isDeletingContract, setIsDeletingContract] = useState(false)
  const [editingSubcontractContract, setEditingSubcontractContract] = useState<SubcontractContractRow | null>(null)
  const [contractForm, setContractForm] = useState({
    vendor_name: '',
    description: '',
    original_amount: '',
    status: 'active' as 'active' | 'closed' | 'cancelled',
    start_date: '',
    end_date: '',
  })
  const [timeDistributionView, setTimeDistributionView] = useState<'employee' | 'phase'>('employee')
  const [projectInfoFormInitialized, setProjectInfoFormInitialized] = useState(false)
  const [projectInfoDynamicInitialized, setProjectInfoDynamicInitialized] = useState(false)
  const [expandedProjectInfoSections, setExpandedProjectInfoSections] = useState<
    Record<string, boolean>
  >({})
  const [projectInfoDynamicValues, setProjectInfoDynamicValues] = useState<Record<string, string>>({})
  const [projectInfoDynamicMultiValues, setProjectInfoDynamicMultiValues] = useState<
    Record<number, string[]>
  >({})
  const [projectInfoDynamicMultiDrafts, setProjectInfoDynamicMultiDrafts] = useState<
    Record<number, string>
  >({})
  const [draggingProjectInfoMultiValue, setDraggingProjectInfoMultiValue] = useState<{
    fieldId: number
    index: number
  } | null>(null)
  const [dragOverProjectInfoMultiValue, setDragOverProjectInfoMultiValue] = useState<{
    fieldId: number
    index: number
  } | null>(null)
  const [selectedBillablesMonth, setSelectedBillablesMonth] = useState(() =>
    formatMonthLabel(subMonths(new Date(), 1), 'yyyy-MM')
  )
  const [collapsedBillablePhases, setCollapsedBillablePhases] = useState<Record<string, boolean>>({})
  const toggleProjectInfoSection = useCallback((sectionKey: string) => {
    setExpandedProjectInfoSections((prev) => ({
      ...prev,
      [sectionKey]: !(prev[sectionKey] ?? true),
    }))
  }, [])
  const [projectInfoForm, setProjectInfoForm] = useState({
    projectNumber: '',
    projectName: '',
    client: '',
    clientAddressLine1: '',
    clientAddressLine2: '',
    clientPhone: '',
    projectDate: '',
    availabilityNumber: '',
    projectManager: '',
    projectEngineer: '',
    cityCounty: '',
  })
  const [projectInfoExtraForm, setProjectInfoExtraForm] = useState<Record<string, string>>(
    buildEmptyExtraProjectInfoForm()
  )
  const expenseChargeSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (searchParams.get('edit') === 'phases') {
      setIsEditOpen(true)
    }
  }, [searchParams])

  const normalizeCurrencyInput = (value: string) => value.replace(/[^0-9.]/g, '')
  const formatCurrencyInput = (value: string) => {
    const numeric = Number(normalizeCurrencyInput(value))
    if (!value || Number.isNaN(numeric)) return ''
    return formatCurrency(numeric)
  }
  const toUpperTrimmedOrNull = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.toUpperCase()
  }
  const formatPhoneForStorage = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (!digits) return null
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return value.trim() || null
  }
  const parseMultiValueString = (value: string | null | undefined) =>
    String(value || '')
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  const preferNewTextOrExisting = (nextValue: string, existingValue: string | null | undefined) => {
    const normalizedNext = toUpperTrimmedOrNull(nextValue)
    if (normalizedNext !== null) return normalizedNext
    return existingValue ?? null
  }
  const preferNewPhoneOrExisting = (nextValue: string, existingValue: string | null | undefined) => {
    const normalizedNext = formatPhoneForStorage(nextValue)
    if (normalizedNext !== null) return normalizedNext
    return formatPhoneForStorage(existingValue || '')
  }

  const handlePhaseDragStart = (index: number) => {
    setDragPhaseIndex(index)
  }

  const handlePhaseDrop = (index: number) => {
    setPhaseDrafts((prev) => {
      if (dragPhaseIndex === null || dragPhaseIndex === index) return prev
      const next = [...prev]
      const [moved] = next.splice(dragPhaseIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragPhaseIndex(null)
  }

  // Fetch project details
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name, address_line_1, address_line_2)
        `)
        .eq('id', projectId)
        .single()
      if (error) throw error
      return data as ProjectWithRelations
    },
  })

  const normalizedProjectNumber = useMemo(
    () => (project?.project_number || '').trim(),
    [project?.project_number]
  )

  const billablesMonthOptions = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 24 }, (_, index) => {
      const monthDate = subMonths(today, index)
      return {
        value: formatMonthLabel(monthDate, 'yyyy-MM'),
        label: formatMonthLabel(monthDate, 'MMMM yyyy'),
      }
    })
  }, [])

  const selectedBillablesMonthLabel =
    billablesMonthOptions.find((option) => option.value === selectedBillablesMonth)?.label ||
    selectedBillablesMonth

  const { billablesMonthStart, billablesMonthEnd } = useMemo(() => {
    const [year, month] = selectedBillablesMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1)
    const end = endOfMonth(start)
    return {
      billablesMonthStart: formatMonthLabel(start, 'yyyy-MM-dd'),
      billablesMonthEnd: formatMonthLabel(end, 'yyyy-MM-dd'),
    }
  }, [selectedBillablesMonth])

  const { data: canonicalMultiplier } = useQuery({
    queryKey: ['project-multiplier', normalizedProjectNumber],
    enabled: Boolean(normalizedProjectNumber),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/multipliers?project_numbers=${encodeURIComponent(normalizedProjectNumber)}`
      )
      if (!response.ok) return null
      const payload = await response.json()
      const value = payload?.multipliers?.[normalizedProjectNumber]
      return typeof value === 'number' ? value : null
    },
  })

  useEffect(() => {
    setProjectInfoFormInitialized(false)
    setProjectInfoDynamicInitialized(false)
    setProjectInfoDynamicValues({})
    setProjectInfoExtraForm(buildEmptyExtraProjectInfoForm())
  }, [projectId])


  const { data: projectManagers } = useQuery({
    queryKey: ['project-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['employee', 'project_manager', 'admin'])
        .order('full_name')
      if (error) throw error
      return data as { id: string; full_name: string }[]
    },
  })

  const { data: teamAssignments, isLoading: loadingTeam, error: teamError } = useQuery({
    queryKey: ['project-team', projectId],
    queryFn: async () => {
      if (!projectId) {
        console.log('[Team Tab] No projectId, returning empty array')
        return []
      }
      console.log('[Team Tab] Fetching team for project ID:', projectId)
      const { data, error } = await supabase
        .from('project_team_assignments')
        .select(`
          id,
          user_id,
          role,
          assigned_at,
          profiles!project_team_assignments_user_id_fkey (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('project_id', projectId)
        .order('assigned_at', { ascending: false })
      if (error) {
        console.error('[Team Tab] Query error:', error)
        throw error
      }
      console.log('[Team Tab] Query success, found:', data?.length, 'members')
      return data as Array<{
        id: number
        user_id: string
        role: string
        assigned_at: string
        profiles: {
          id: string
          full_name: string
          email: string
          role: string
        } | null
      }>
    },
  })

  const { data: cityCountyOptions } = useQuery({
    queryKey: ['city-county-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('city_county_options' as never)
        .select('name')
        .eq('is_active' as never, true as never)
        .order('name')
      if (error) throw error
      return ((data || []) as Array<{ name: string | null }>)
        .map((row) => (row.name || '').trim())
        .filter(Boolean)
    },
  })

  const { data: engineerOptions } = useQuery({
    queryKey: ['engineer-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers' as never)
        .select('full_name')
        .eq('is_active' as never, true as never)
        .order('full_name')
      if (error) throw error
      return ((data || []) as Array<{ full_name: string | null }>)
        .map((row) => (row.full_name || '').trim())
        .filter(Boolean)
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

  const managerNameFromProject = useMemo(() => {
    if (!projectManagers || !project) return ''
    return projectManagers.find((manager) => manager.id === project.pm_id)?.full_name || ''
  }, [projectManagers, project])

  const dynamicProjectInfoSections = useMemo(() => {
    const sections = projectInfoSchema?.sections || []
    const fields = projectInfoSchema?.fields || []
    if (!sections.length || !fields.length) return []
    return sections
      .filter((section) => section.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((section) => ({
        ...section,
        fields: fields
          .filter((field) => field.section_id === section.id && field.is_active)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }))
      .filter((section) => section.fields.length > 0)
  }, [projectInfoSchema])

  const hasDynamicProjectInfoSchema = Boolean(
    (projectInfoSchema?.sections?.length || 0) > 0 || (projectInfoSchema?.fields?.length || 0) > 0
  )

  const dynamicProjectInfoOptionsByFieldId = useMemo(() => {
    const map = new Map<number, ProjectInfoFieldOptionCatalogRow[]>()
    ;(projectInfoSchema?.options || [])
      .filter((option) => option.is_active)
      .forEach((option) => {
        const list = map.get(option.field_id) || []
        list.push(option)
        map.set(option.field_id, list)
      })
    map.forEach((list, fieldId) => {
      map.set(
        fieldId,
        [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      )
    })
    return map
  }, [projectInfoSchema])

  const { data: projectOptions } = useQuery({
    queryKey: ['project-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_number')
        .order('project_number')
      if (error) throw error
      return data as Array<{ id: number; project_number: string }>
    },
  })

  const projectNumbers = useMemo(() => {
    return (projectOptions || [])
      .map((project) => project.project_number)
      .filter(Boolean)
  }, [projectOptions])

  const projectNumberToId = useMemo(() => {
    const map = new Map<string, number>()
    projectOptions?.forEach((project) => {
      if (project.project_number) {
        map.set(project.project_number, project.id)
      }
    })
    return map
  }, [projectOptions])

  const { data: projectInfo } = useQuery({
    queryKey: ['project-info', projectId],
    enabled: Number.isFinite(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_info' as never)
        .select('*')
        .eq('project_id' as never, projectId as never)
        .maybeSingle()
      if (error) throw error
      return (data as ProjectInfoRow | null) ?? null
    },
  })

  const { data: projectInfoFieldValues } = useQuery({
    queryKey: ['project-info-field-values', projectId],
    enabled: Number.isFinite(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_info_field_values' as never)
        .select('id, project_id, field_id, value, sort_order, is_active')
        .eq('project_id' as never, projectId as never)
        .eq('is_active' as never, true as never)
        .order('field_id', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
      if (error) throw error
      return ((data as ProjectInfoFieldValueRow[] | null) || []) as ProjectInfoFieldValueRow[]
    },
  })

  const dynamicProjectInfoValuesByFieldId = useMemo(() => {
    const map = new Map<number, string[]>()
    ;(projectInfoFieldValues || []).forEach((row) => {
      const list = map.get(row.field_id) || []
      list.push((row.value || '').trim())
      map.set(row.field_id, list)
    })
    return map
  }, [projectInfoFieldValues])

  const saveProjectInfo = useMutation({
    mutationFn: async () => {
      if (!projectInfoFormInitialized) {
        throw new Error('Project info is still loading. Please try again in a moment.')
      }
      const { data: existingRow, error: existingError } = await supabase
        .from('project_info' as never)
        .select('*')
        .eq('project_id' as never, projectId as never)
        .maybeSingle()
      if (existingError) throw existingError
      const current = (existingRow as Partial<ProjectInfoRow> | null) ?? null
      const extraPayload = Object.fromEntries(
        PROJECT_INFO_EXTRA_FIELDS.map(({ column }) => {
          const currentValue =
            (current?.[column] as string | null | undefined) ??
            (projectInfo?.[column] as string | null | undefined)
          const nextValue = projectInfoExtraForm[column] || ''
          const normalizedValue = PROJECT_INFO_EXTRA_PHONE_COLUMNS.has(column)
            ? preferNewPhoneOrExisting(nextValue, currentValue)
            : preferNewTextOrExisting(nextValue, currentValue)
          return [column, normalizedValue]
        })
      )

      const payload = {
        project_id: projectId,
        project_number:
          toUpperTrimmedOrNull(project?.project_number || '') ??
          toUpperTrimmedOrNull(projectInfo?.project_number || ''),
        project_name:
          toUpperTrimmedOrNull(project?.name || '') ??
          toUpperTrimmedOrNull(projectInfo?.project_name || ''),
        client_name:
          toUpperTrimmedOrNull(project?.clients?.name || '') ??
          toUpperTrimmedOrNull(projectInfo?.client_name || ''),
        client_address_line_1:
          preferNewTextOrExisting(
            projectInfoForm.clientAddressLine1,
            current?.client_address_line_1 ?? projectInfo?.client_address_line_1
          ),
        client_address_line_2:
          preferNewTextOrExisting(
            projectInfoForm.clientAddressLine2,
            current?.client_address_line_2 ?? projectInfo?.client_address_line_2
          ),
        client_phone:
          preferNewPhoneOrExisting(
            projectInfoForm.clientPhone,
            current?.client_phone ?? projectInfo?.client_phone
          ),
        project_date:
          preferNewTextOrExisting(
            projectInfoForm.projectDate,
            current?.project_date ?? projectInfo?.project_date
          ),
        availability_number:
          preferNewTextOrExisting(
            projectInfoForm.availabilityNumber,
            current?.availability_number ?? projectInfo?.availability_number
          ) ??
          toUpperTrimmedOrNull(project?.permit_reference || ''),
        project_manager:
          preferNewTextOrExisting(
            projectInfoForm.projectManager,
            current?.project_manager ?? projectInfo?.project_manager
          ),
        project_engineer:
          preferNewTextOrExisting(
            projectInfoForm.projectEngineer,
            current?.project_engineer ?? projectInfo?.project_engineer
          ),
        city_county:
          preferNewTextOrExisting(
            projectInfoForm.cityCounty,
            current?.city_county ?? projectInfo?.city_county
          ) ??
          toUpperTrimmedOrNull(project?.municipality || ''),
        ...extraPayload,
      }
      const { error } = await supabase
        .from('project_info' as never)
        .upsert(payload as never, { onConflict: 'project_id' } as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-info', projectId] })
      setProjectInfoForm((prev) => ({
        ...prev,
        clientAddressLine1:
          preferNewTextOrExisting(prev.clientAddressLine1, projectInfo?.client_address_line_1) || '',
        clientAddressLine2:
          preferNewTextOrExisting(prev.clientAddressLine2, projectInfo?.client_address_line_2) || '',
        clientPhone: formatPhoneForStorage(prev.clientPhone) || '',
        projectDate: preferNewTextOrExisting(prev.projectDate, projectInfo?.project_date) || '',
        availabilityNumber:
          preferNewTextOrExisting(prev.availabilityNumber, projectInfo?.availability_number) || '',
        projectManager:
          preferNewTextOrExisting(prev.projectManager, projectInfo?.project_manager) || '',
        projectEngineer:
          preferNewTextOrExisting(prev.projectEngineer, projectInfo?.project_engineer) || '',
        cityCounty: preferNewTextOrExisting(prev.cityCounty, projectInfo?.city_county) || '',
      }))
      setProjectInfoExtraForm((prev) => {
        const next: Record<string, string> = { ...prev }
        PROJECT_INFO_EXTRA_FIELDS.forEach(({ column }) => {
          if (PROJECT_INFO_EXTRA_PHONE_COLUMNS.has(column)) {
            next[column] = formatPhoneForStorage(prev[column] || '') || ''
          } else {
            next[column] =
              preferNewTextOrExisting(
                prev[column] || '',
                (projectInfo?.[column] as string | null | undefined) ?? null
              ) || ''
          }
        })
        return next
      })
      toast.success('Project info saved')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save project info')
    },
  })

  const ensureProjectInfoRow = useMutation({
    mutationFn: async () => {
      const extraPayload = Object.fromEntries(
        PROJECT_INFO_EXTRA_FIELDS.map(({ column }) => {
          const nextValue = projectInfoExtraForm[column] || ''
          const normalizedValue = PROJECT_INFO_EXTRA_PHONE_COLUMNS.has(column)
            ? formatPhoneForStorage(nextValue)
            : toUpperTrimmedOrNull(nextValue)
          return [column, normalizedValue]
        })
      )
      const payload = {
        project_id: projectId,
        project_number:
          toUpperTrimmedOrNull(project?.project_number || '') ??
          toUpperTrimmedOrNull(projectInfoForm.projectNumber),
        project_name:
          toUpperTrimmedOrNull(project?.name || '') ?? toUpperTrimmedOrNull(projectInfoForm.projectName),
        client_name:
          toUpperTrimmedOrNull(project?.clients?.name || '') ??
          toUpperTrimmedOrNull(projectInfoForm.client),
        client_address_line_1: toUpperTrimmedOrNull(projectInfoForm.clientAddressLine1),
        client_address_line_2: toUpperTrimmedOrNull(projectInfoForm.clientAddressLine2),
        client_phone: formatPhoneForStorage(projectInfoForm.clientPhone),
        project_date: toUpperTrimmedOrNull(projectInfoForm.projectDate),
        availability_number: toUpperTrimmedOrNull(projectInfoForm.availabilityNumber),
        project_manager: toUpperTrimmedOrNull(projectInfoForm.projectManager),
        project_engineer: toUpperTrimmedOrNull(projectInfoForm.projectEngineer),
        city_county: toUpperTrimmedOrNull(projectInfoForm.cityCounty),
        ...extraPayload,
      }
      const { error } = await supabase
        .from('project_info' as never)
        .upsert(payload as never, { onConflict: 'project_id' } as never)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-info', projectId] })
    },
  })

  useEffect(() => {
    if (!project || !projectManagers || projectInfoFormInitialized) return
    const managerName =
      projectInfo?.project_manager ??
      projectManagers.find((manager) => manager.id === project.pm_id)?.full_name ??
      ''
    setProjectInfoForm({
      projectNumber:
        projectInfo?.project_number?.toUpperCase() ?? project.project_number?.toUpperCase() ?? '',
      projectName: projectInfo?.project_name?.toUpperCase() ?? project.name?.toUpperCase() ?? '',
      client: projectInfo?.client_name?.toUpperCase() ?? project.clients?.name?.toUpperCase() ?? '',
      clientAddressLine1:
        projectInfo?.client_address_line_1?.toUpperCase() ??
        project.clients?.address_line_1?.toUpperCase() ??
        '',
      clientAddressLine2:
        projectInfo?.client_address_line_2?.toUpperCase() ??
        project.clients?.address_line_2?.toUpperCase() ??
        '',
      clientPhone: formatPhoneForStorage(projectInfo?.client_phone || '') || '',
      projectDate: projectInfo?.project_date?.toUpperCase() ?? '',
      availabilityNumber:
        projectInfo?.availability_number?.toUpperCase() ??
        project.permit_reference?.toUpperCase() ??
        '',
      projectManager: managerName.toUpperCase(),
      projectEngineer: (projectInfo?.project_engineer ?? '').toUpperCase(),
      cityCounty:
        projectInfo?.city_county?.toUpperCase() ?? project.municipality?.toUpperCase() ?? '',
    })
    const hydratedExtras = buildEmptyExtraProjectInfoForm()
    PROJECT_INFO_EXTRA_FIELDS.forEach(({ column }) => {
      const raw = ((projectInfo?.[column] as string | null | undefined) ?? '').trim()
      hydratedExtras[column] = PROJECT_INFO_EXTRA_PHONE_COLUMNS.has(column)
        ? formatPhoneForStorage(raw) || ''
        : raw.toUpperCase()
    })
    setProjectInfoExtraForm(hydratedExtras)
    setProjectInfoFormInitialized(true)
  }, [project, projectManagers, projectInfo, projectInfoFormInitialized])

  useEffect(() => {
    if (!projectInfoFormInitialized || projectInfo || ensureProjectInfoRow.isPending) return
    ensureProjectInfoRow.mutate()
  }, [projectInfoFormInitialized, projectInfo, ensureProjectInfoRow])

  useEffect(() => {
    if (!hasDynamicProjectInfoSchema || !project) return
    const nextValues: Record<string, string> = {}
    const nextMultiValues: Record<number, string[]> = {}
    dynamicProjectInfoSections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.value_mode === 'multi') {
          const existingMultiValues = (dynamicProjectInfoValuesByFieldId.get(field.id) || [])
            .map((value) => value.trim())
            .filter(Boolean)
          if (existingMultiValues.length > 0) {
            nextMultiValues[field.id] = existingMultiValues
            return
          }
          const scalarFallback = (projectInfo?.[field.column_name] as string | null | undefined) || ''
          nextMultiValues[field.id] = parseMultiValueString(scalarFallback)
          return
        }

        const existingValue = (projectInfo?.[field.column_name] as string | null | undefined) || ''
        if (existingValue) {
          nextValues[field.column_name] =
            field.input_type === 'phone' ? formatPhoneForStorage(existingValue) || '' : existingValue
          return
        }

        // Sensible defaults for canonical core project metadata.
        switch (field.column_name) {
          case 'project_number':
            nextValues[field.column_name] = (project.project_number || '').toUpperCase()
            break
          case 'project_name':
            nextValues[field.column_name] = (project.name || '').toUpperCase()
            break
          case 'client_name':
            nextValues[field.column_name] = (project.clients?.name || '').toUpperCase()
            break
          case 'client_address_line_1':
            nextValues[field.column_name] = (project.clients?.address_line_1 || '').toUpperCase()
            break
          case 'client_address_line_2':
            nextValues[field.column_name] = (project.clients?.address_line_2 || '').toUpperCase()
            break
          case 'city_county':
            nextValues[field.column_name] = (project.municipality || '').toUpperCase()
            break
          case 'availability_number':
            nextValues[field.column_name] = (project.permit_reference || '').toUpperCase()
            break
          case 'project_manager':
            nextValues[field.column_name] = (managerNameFromProject || '').toUpperCase()
            break
          default:
            nextValues[field.column_name] = ''
            break
        }
      })
    })
    setProjectInfoDynamicValues(nextValues)
    setProjectInfoDynamicMultiValues(nextMultiValues)
    setProjectInfoDynamicInitialized(true)
  }, [
    hasDynamicProjectInfoSchema,
    dynamicProjectInfoSections,
    dynamicProjectInfoValuesByFieldId,
    project,
    projectInfo,
    managerNameFromProject,
  ])

  const saveProjectInfoDynamic = useMutation({
    mutationFn: async () => {
      if (!project || !hasDynamicProjectInfoSchema) return
      const payload: Record<string, unknown> = { project_id: projectId }
      const multiFieldIds: number[] = []
      const multiValueInserts: Array<{
        project_id: number
        field_id: number
        value: string
        sort_order: number
        is_active: boolean
      }> = []
      dynamicProjectInfoSections.forEach((section) => {
        section.fields.forEach((field) => {
          if (field.value_mode === 'multi') {
            multiFieldIds.push(field.id)
            const list = (projectInfoDynamicMultiValues[field.id] || [])
              .map((value) => value.trim())
              .filter(Boolean)
            list.forEach((value, index) => {
              multiValueInserts.push({
                project_id: projectId,
                field_id: field.id,
                value,
                sort_order: index + 1,
                is_active: true,
              })
            })
            payload[field.column_name] = null
            return
          }

          const currentValue = projectInfoDynamicValues[field.column_name] || ''
          if (field.input_type === 'phone') {
            payload[field.column_name] = formatPhoneForStorage(currentValue)
          } else {
            payload[field.column_name] = toUpperTrimmedOrNull(currentValue)
          }
        })
      })
      const { error } = await supabase
        .from('project_info' as never)
        .upsert(payload as never, { onConflict: 'project_id' } as never)
      if (error) throw error

      if (multiFieldIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('project_info_field_values' as never)
          .delete()
          .eq('project_id' as never, projectId as never)
          .in('field_id' as never, multiFieldIds as never)
        if (deleteError) throw deleteError

        if (multiValueInserts.length > 0) {
          const { error: insertError } = await supabase
            .from('project_info_field_values' as never)
            .insert(multiValueInserts as never)
          if (insertError) throw insertError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-info', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-info-field-values', projectId] })
      toast.success('Project info saved')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save project info')
    },
  })

  const renderDynamicProjectInfoFieldControl = (field: ProjectInfoFieldCatalogRow) => {
    const value = projectInfoDynamicValues[field.column_name] || ''

    if (field.value_mode === 'multi') {
      const values = (projectInfoDynamicMultiValues[field.id] || [])
        .map((entry) => entry.trim())
        .filter(Boolean)
      const draftValue = projectInfoDynamicMultiDrafts[field.id] || ''

      const addMultiValue = () => {
        const nextValue = draftValue.trim()
        if (!nextValue) return
        setProjectInfoDynamicMultiValues((prev) => ({
          ...prev,
          [field.id]: [...(prev[field.id] || []), nextValue],
        }))
        setProjectInfoDynamicMultiDrafts((prev) => ({ ...prev, [field.id]: '' }))
      }

      const removeMultiValueAtIndex = (index: number) => {
        setProjectInfoDynamicMultiValues((prev) => {
          const current = [...(prev[field.id] || [])]
          current.splice(index, 1)
          return { ...prev, [field.id]: current }
        })
      }

      const reorderMultiValues = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return
        setProjectInfoDynamicMultiValues((prev) => {
          const current = [...(prev[field.id] || [])]
          if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) {
            return prev
          }
          const [moved] = current.splice(fromIndex, 1)
          current.splice(toIndex, 0, moved)
          return { ...prev, [field.id]: current }
        })
      }

      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {values.map((entry, index) => (
              <div
                key={`${field.id}-multi-chip-${index}`}
                className={`flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs ${
                  draggingProjectInfoMultiValue?.fieldId === field.id &&
                  dragOverProjectInfoMultiValue?.fieldId === field.id &&
                  dragOverProjectInfoMultiValue.index === index
                    ? 'ring-2 ring-primary'
                    : ''
                }`}
                draggable
                onDragStart={() => setDraggingProjectInfoMultiValue({ fieldId: field.id, index })}
                onDragEnd={() => {
                  setDraggingProjectInfoMultiValue(null)
                  setDragOverProjectInfoMultiValue(null)
                }}
                onDragOver={(event) => {
                  if (!draggingProjectInfoMultiValue || draggingProjectInfoMultiValue.fieldId !== field.id) {
                    return
                  }
                  event.preventDefault()
                  setDragOverProjectInfoMultiValue({ fieldId: field.id, index })
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!draggingProjectInfoMultiValue || draggingProjectInfoMultiValue.fieldId !== field.id) {
                    return
                  }
                  reorderMultiValues(draggingProjectInfoMultiValue.index, index)
                  setDraggingProjectInfoMultiValue(null)
                  setDragOverProjectInfoMultiValue(null)
                }}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{entry}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => removeMultiValueAtIndex(index)}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove value</span>
                </Button>
              </div>
            ))}
            {values.length === 0 ? (
              <span className="text-xs text-muted-foreground">No values yet</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={draftValue}
              placeholder={`Add ${field.label} value`}
              onChange={(event) =>
                setProjectInfoDynamicMultiDrafts((prev) => ({
                  ...prev,
                  [field.id]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addMultiValue()
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => addMultiValue()}>
              Add
            </Button>
          </div>
        </div>
      )
    }

    if (field.input_type === 'select') {
      const staticOptions =
        (dynamicProjectInfoOptionsByFieldId.get(field.id) || []).map((option) => ({
          label: option.label,
          value: option.value,
        })) || []
      const sourceOptions =
        field.source_type === 'project_managers'
          ? (projectManagers || []).map((manager) => ({
              label: (manager.full_name || '').toUpperCase(),
              value: (manager.full_name || '').toUpperCase(),
            }))
          : field.source_type === 'engineers'
            ? (engineerOptions || []).map((name) => ({ label: name, value: name.toUpperCase() }))
            : field.source_type === 'city_county'
              ? (cityCountyOptions || []).map((name) => ({ label: name, value: name.toUpperCase() }))
              : staticOptions
      const deduped = new Map<string, string>()
      sourceOptions.forEach((option) => {
        if (!deduped.has(option.value)) deduped.set(option.value, option.label)
      })
      if (value && !deduped.has(value)) deduped.set(value, value)

      return (
        <Select
          value={value || 'unassigned'}
          onValueChange={(nextValue) =>
            setProjectInfoDynamicValues((prev) => ({
              ...prev,
              [field.column_name]: nextValue === 'unassigned' ? '' : nextValue,
            }))
          }
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">UNASSIGNED</SelectItem>
            {Array.from(deduped.entries()).map(([optionValue, optionLabel]) => (
              <SelectItem key={`${field.id}-${optionValue}`} value={optionValue}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (field.input_type === 'textarea') {
      return (
        <Textarea
          value={value}
          onChange={(event) =>
            setProjectInfoDynamicValues((prev) => ({
              ...prev,
              [field.column_name]: event.target.value,
            }))
          }
          rows={2}
        />
      )
    }

    return (
      <Input
        type={field.input_type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(event) =>
          setProjectInfoDynamicValues((prev) => ({
            ...prev,
            [field.column_name]: event.target.value,
          }))
        }
      />
    )
  }

  const renderProjectInfoFieldControl = (field: ProjectInfoGroupedField) => {
    if (field.key.startsWith('extra.')) {
      const column = field.key.replace('extra.', '')
      return (
        <Input
          value={projectInfoExtraForm[column] || ''}
          onChange={(event) =>
            setProjectInfoExtraForm((prev) => ({
              ...prev,
              [column]: event.target.value,
            }))
          }
        />
      )
    }

    switch (field.key) {
      case 'core.projectNumber':
        return <Input value={projectInfoForm.projectNumber} disabled />
      case 'core.projectName':
        return <Input value={projectInfoForm.projectName} disabled />
      case 'core.client':
        return <Input value={projectInfoForm.client} disabled />
      case 'core.projectManager':
        return (
          <Select
            value={projectInfoForm.projectManager || 'unassigned'}
            onValueChange={(value) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                projectManager: value === 'unassigned' ? '' : value,
              }))
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select project manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">UNASSIGNED</SelectItem>
              {projectManagers?.map((manager) => (
                <SelectItem key={manager.id} value={(manager.full_name || '').toUpperCase()}>
                  {(manager.full_name || '').toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'core.projectEngineer':
        return (
          <Select
            value={projectInfoForm.projectEngineer || 'unassigned'}
            onValueChange={(value) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                projectEngineer: value === 'unassigned' ? '' : value,
              }))
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select project engineer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">UNASSIGNED</SelectItem>
              {engineerOptions?.map((engineerName) => (
                <SelectItem key={engineerName} value={engineerName.toUpperCase()}>
                  {engineerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'core.cityCounty':
        return (
          <Select
            value={projectInfoForm.cityCounty || 'unassigned'}
            onValueChange={(value) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                cityCounty: value === 'unassigned' ? '' : value,
              }))
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select city/county" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">UNASSIGNED</SelectItem>
              {projectInfoForm.cityCounty && !cityCountyOptions?.includes(projectInfoForm.cityCounty) && (
                <SelectItem value={projectInfoForm.cityCounty}>{projectInfoForm.cityCounty}</SelectItem>
              )}
              {(cityCountyOptions || []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'core.clientAddressLine1':
        return (
          <Input
            value={projectInfoForm.clientAddressLine1}
            onChange={(event) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                clientAddressLine1: event.target.value,
              }))
            }
          />
        )
      case 'core.clientAddressLine2':
        return (
          <Input
            value={projectInfoForm.clientAddressLine2}
            onChange={(event) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                clientAddressLine2: event.target.value,
              }))
            }
          />
        )
      case 'core.clientPhone':
        return (
          <Input
            value={projectInfoForm.clientPhone}
            onChange={(event) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                clientPhone: event.target.value,
              }))
            }
          />
        )
      case 'core.projectDate':
        return (
          <Input
            value={projectInfoForm.projectDate}
            onChange={(event) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                projectDate: event.target.value,
              }))
            }
          />
        )
      case 'core.availabilityNumber':
        return (
          <Input
            value={projectInfoForm.availabilityNumber}
            onChange={(event) =>
              setProjectInfoForm((prev) => ({
                ...prev,
                availabilityNumber: event.target.value,
              }))
            }
          />
        )
      default:
        return <Input value="" disabled />
    }
  }

  const handleAddPhaseRow = () => {
    setPhaseDrafts((prev) => [
      ...prev,
      {
        phase_code: '',
        phase_name: '',
        billing_type: 'L',
        total_fee: '',
      },
    ])
  }

  const handleRemovePhaseRow = (index: number) => {
    setPhaseDrafts((prev) => {
      const next = [...prev]
      const removed = next.splice(index, 1)[0]
      if (removed?.id) {
        setDeletedPhaseIds((current) => [...current, removed.id!])
      }
      return next
    })
  }

  const handleSaveProjectEdits = async () => {
    setIsSavingEdits(true)
    try {
      const trimmed = phaseDrafts.map((phase) => ({
        ...phase,
        phase_code: phase.phase_code.trim(),
        phase_name: phase.phase_name.trim(),
        total_fee: phase.total_fee.trim(),
      }))

      const invalidRow = trimmed.find(
        (phase) => !phase.phase_code || !phase.phase_name || !phase.total_fee
      )
      if (invalidRow) {
        toast.error('Please fill out phase code, name, and total fee.')
        setIsSavingEdits(false)
        return
      }

      const updates = trimmed.filter((phase) => phase.id)
      const inserts = trimmed.filter((phase) => !phase.id)

      if (deletedPhaseIds.length) {
        const { error } = await supabase
          .from('contract_phases')
          .delete()
          .in('id', deletedPhaseIds as never)
        if (error) throw error
      }

      if (updates.length) {
        for (const phase of updates) {
          const totalFeeValue = Number(normalizeCurrencyInput(phase.total_fee))
          const { error } = await supabase
            .from('contract_phases')
            .update({
              phase_code: phase.phase_code,
              phase_name: phase.phase_name,
              billing_type: phase.billing_type,
              total_fee: totalFeeValue,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id' as never, phase.id as never)
          if (error) throw error
        }
      }

      if (inserts.length) {
        const payload = inserts.map((phase) => ({
          project_id: projectId,
          phase_code: phase.phase_code,
          phase_name: phase.phase_name,
          billing_type: phase.billing_type,
          total_fee: Number(normalizeCurrencyInput(phase.total_fee)),
        }))
        const { error } = await supabase.from('contract_phases').insert(payload as never)
        if (error) throw error
      }

      toast.success('Project updated')
      setDeletedPhaseIds([])
      setIsEditOpen(false)
      queryClient.invalidateQueries({ queryKey: ['project-phases', projectId] })
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save project')
    } finally {
      setIsSavingEdits(false)
    }
  }

  // Fetch contract phases
  const { data: phases, isLoading: loadingPhases } = useQuery({
    queryKey: ['project-phases', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_code')
      if (error) throw error
      return data as Tables<'contract_phases'>[]
    },
  })

  useEffect(() => {
    if (!phases) return
    setPhaseDrafts(
      phases.map((phase) => ({
        id: phase.id,
        phase_code: phase.phase_code,
        phase_name: phase.phase_name,
        billing_type: phase.billing_type,
        total_fee:
          phase.total_fee === null || typeof phase.total_fee === 'undefined'
            ? ''
            : formatCurrency(Number(phase.total_fee)),
      }))
    )
  }, [phases])

  // Fetch invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['project-invoices', normalizedProjectNumber],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as Tables<'invoices'>[]
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_number', projectNumber)
        .order('date_issued', { ascending: false })
      if (error) throw error
      return data as Tables<'invoices'>[]
    },
    enabled: !!normalizedProjectNumber,
  })

  const { data: invoiceLineItems } = useQuery({
    queryKey: ['project-invoice-line-items', projectId, invoices?.length || 0],
    queryFn: async () => {
      const invoiceIds = invoices?.map((invoice) => invoice.id) || []
      if (invoiceIds.length === 0) return [] as Tables<'invoice_line_items'>[]
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, phase_name, amount, line_type')
        .in('invoice_id', invoiceIds as never)
      if (error) throw error
      return data as Tables<'invoice_line_items'>[]
    },
    enabled: !!invoices,
  })

  const excludedEmployees = new Set(['Morgan Wilson'])

  async function fetchProjectTimeEntries(projectNumber: string, projectRowId: number) {
    const pageSize = 1000
    const byNumber: Tables<'time_entries'>[] = []
    const byId: Tables<'time_entries'>[] = []

    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_number', projectNumber)
        .order('entry_date', { ascending: false })
        .range(from, from + pageSize - 1)
      if (error) throw error
      const batch = (data as Tables<'time_entries'>[]) || []
      byNumber.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
    }

    from = 0
    while (true) {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectRowId as never)
        .order('entry_date', { ascending: false })
        .range(from, from + pageSize - 1)
      if (error) throw error
      const batch = (data as Tables<'time_entries'>[]) || []
      byId.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
    }

    const uniqueById = new Map<number, Tables<'time_entries'>>()
    ;[...byNumber, ...byId].forEach((entry) => {
      uniqueById.set(entry.id, entry)
    })
    return Array.from(uniqueById.values()).filter(
      (entry) => !excludedEmployees.has(entry.employee_name || '')
    )
  }

  // Fetch ALL time entries for this project (for charts)
  const { data: allTimeEntries, isLoading: loadingAllTime } = useQuery({
    queryKey: ['project-all-time', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as Tables<'time_entries'>[]
      return fetchProjectTimeEntries(projectNumber, projectId)
    },
    enabled: !!normalizedProjectNumber,
  })

  // Fetch time entries for the table (all entries)
  const { data: timeEntries, isLoading: loadingTime } = useQuery({
    queryKey: ['project-time', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as Tables<'time_entries'>[]
      return fetchProjectTimeEntries(projectNumber, projectId)
    },
    enabled: !!normalizedProjectNumber,
  })

  const { data: projectBillables, isLoading: loadingProjectBillables } = useQuery({
    queryKey: ['project-billables', normalizedProjectNumber, projectId, selectedBillablesMonth],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) {
        return {
          phases: {} as Record<
            string,
            {
              phase_name: string
              employees: Record<
                string,
                { employee_name: string; entries: ProjectBillablesEntry[]; total: number }
              >
              total: number
            }
          >,
          grandTotal: 0,
          projectName: '',
        }
      }

      const { data: timeEntriesRows, error: timeError } = await supabase
        .from('time_entries')
        .select(
          `
          id,
          employee_id,
          employee_name,
          entry_date,
          project_number,
          project_id,
          phase_name,
          hours,
          notes,
          projects (name)
        `
        )
        .eq('project_number', projectNumber)
        .gte('entry_date', billablesMonthStart)
        .lte('entry_date', billablesMonthEnd)
        .order('phase_name')
        .order('employee_name')
        .order('entry_date')

      if (timeError) throw timeError

      const typedEntries = ((timeEntriesRows || []) as Array<
        Tables<'time_entries'> & { projects: { name: string } | null }
      >).filter((entry) => Boolean((entry.project_number || '').trim()))

      if (typedEntries.length === 0) {
        return {
          phases: {} as Record<
            string,
            {
              phase_name: string
              employees: Record<
                string,
                { employee_name: string; entries: ProjectBillablesEntry[]; total: number }
              >
              total: number
            }
          >,
          grandTotal: 0,
          projectName: project?.name || '',
        }
      }

      const entryIds = typedEntries.map((entry) => entry.id)
      const projectIds = Array.from(
        new Set(typedEntries.map((entry) => entry.project_id).filter((value): value is number => Boolean(value)))
      )
      const employeeIds = Array.from(
        new Set(
          typedEntries
            .map((entry) => entry.employee_id)
            .filter((value): value is string => Boolean(value))
        )
      )

      const { data: snapRates } = entryIds.length
        ? await supabase
            .from('time_entry_bill_rates')
            .select('time_entry_id, resolved_hourly_rate')
            .in('time_entry_id' as never, entryIds as never)
        : { data: [] as Array<{ time_entry_id: number; resolved_hourly_rate: number }> }

      const { data: projectScheduleAssignments } = projectIds.length
        ? await supabase
            .from('project_rate_schedule_assignments')
            .select('project_id, schedule_id')
            .in('project_id' as never, projectIds as never)
        : { data: [] as Array<{ project_id: number; schedule_id: number }> }

      const { data: projectsForRates } = projectIds.length
        ? await supabase
            .from('projects')
            .select('id, proposal_id, proposals(date_submitted)')
            .in('id' as never, projectIds as never)
        : {
            data: [] as Array<{
              id: number
              proposal_id: number | null
              proposals: { date_submitted: string | null } | null
            }>,
          }

      const { data: schedules } = await supabase.from('rate_schedules').select('id, year_label')
      const { data: scheduleItems } = await supabase
        .from('rate_schedule_items')
        .select('schedule_id, position_id, hourly_rate')

      const { data: projectOverrides } = projectIds.length
        ? await supabase
            .from('project_rate_position_overrides')
            .select('project_id, position_id, hourly_rate, effective_from, effective_to')
            .in('project_id' as never, projectIds as never)
        : {
            data: [] as Array<{
              project_id: number
              position_id: number
              hourly_rate: number
              effective_from: string | null
              effective_to: string | null
            }>,
          }

      const { data: profilePositions } = employeeIds.length
        ? await supabase
            .from('profiles')
            .select('id, rate_position_id')
            .in('id' as never, employeeIds as never)
        : { data: [] as Array<{ id: string; rate_position_id: number | null }> }

      const { data: timelineRows } = employeeIds.length
        ? await supabase
            .from('employee_title_history')
            .select('employee_id, rate_position_id, effective_from, effective_to')
            .in('employee_id' as never, employeeIds as never)
        : {
            data: [] as Array<{
              employee_id: string
              rate_position_id: number | null
              effective_from: string
              effective_to: string | null
            }>,
          }

      const snapRateByEntryId = new Map<number, number>()
      ;((snapRates as Array<{ time_entry_id: number; resolved_hourly_rate: number }> | null) || []).forEach(
        (row) => {
          snapRateByEntryId.set(row.time_entry_id, Number(row.resolved_hourly_rate) || 0)
        }
      )

      const scheduleIdByProjectId = new Map<number, number>()
      ;((projectScheduleAssignments as Array<{ project_id: number; schedule_id: number }> | null) || []).forEach(
        (row) => {
          scheduleIdByProjectId.set(row.project_id, row.schedule_id)
        }
      )

      const scheduleIdByYear = new Map<number, number>()
      ;((schedules as Array<{ id: number; year_label: number }> | null) || []).forEach((row) => {
        scheduleIdByYear.set(Number(row.year_label), row.id)
      })

      ;(
        (projectsForRates as
          | Array<{ id: number; proposal_id: number | null; proposals: { date_submitted: string | null } | null }>
          | null) || []
      ).forEach((projectRow) => {
        if (scheduleIdByProjectId.has(projectRow.id)) return
        const submittedDate = projectRow.proposals?.date_submitted
        if (!submittedDate) return
        const year = Number(submittedDate.slice(0, 4))
        const scheduleId = scheduleIdByYear.get(year)
        if (scheduleId) scheduleIdByProjectId.set(projectRow.id, scheduleId)
      })

      const scheduleRateByScheduleAndPosition = new Map<string, number>()
      ;((scheduleItems as Array<{ schedule_id: number; position_id: number; hourly_rate: number }> | null) || [])
        .forEach((row) => {
          scheduleRateByScheduleAndPosition.set(
            `${row.schedule_id}::${row.position_id}`,
            Number(row.hourly_rate) || 0
          )
        })

      const overridesByProjectAndPosition = new Map<
        string,
        Array<{
          project_id: number
          position_id: number
          hourly_rate: number
          effective_from: string | null
          effective_to: string | null
        }>
      >()
      ;(
        (projectOverrides as
          | Array<{
              project_id: number
              position_id: number
              hourly_rate: number
              effective_from: string | null
              effective_to: string | null
            }>
          | null) || []
      ).forEach((row) => {
        const key = `${row.project_id}::${row.position_id}`
        const current = overridesByProjectAndPosition.get(key) || []
        current.push(row)
        overridesByProjectAndPosition.set(key, current)
      })

      const profilePositionByEmployeeId = new Map<string, number | null>()
      ;((profilePositions as Array<{ id: string; rate_position_id: number | null }> | null) || []).forEach(
        (row) => {
          profilePositionByEmployeeId.set(row.id, row.rate_position_id)
        }
      )

      const timelineByEmployeeId = new Map<
        string,
        Array<{
          employee_id: string
          rate_position_id: number | null
          effective_from: string
          effective_to: string | null
        }>
      >()
      ;(
        (timelineRows as
          | Array<{
              employee_id: string
              rate_position_id: number | null
              effective_from: string
              effective_to: string | null
            }>
          | null) || []
      ).forEach((row) => {
        const current = timelineByEmployeeId.get(row.employee_id) || []
        current.push(row)
        timelineByEmployeeId.set(row.employee_id, current)
      })

      const entriesWithRates: ProjectBillablesEntry[] = []
      for (const entry of typedEntries) {
        const snapshotRate = snapRateByEntryId.get(entry.id)
        const employeeTimelineRows = entry.employee_id ? timelineByEmployeeId.get(entry.employee_id) || [] : []
        const timelineMatch = employeeTimelineRows
          .filter(
            (row) =>
              (!row.effective_from || row.effective_from <= entry.entry_date) &&
              (!row.effective_to || row.effective_to >= entry.entry_date)
          )
          .sort((a, b) => (a.effective_from > b.effective_from ? -1 : 1))[0]
        const positionId =
          timelineMatch?.rate_position_id ??
          (entry.employee_id ? profilePositionByEmployeeId.get(entry.employee_id) ?? null : null)

        const scheduleId = entry.project_id ? scheduleIdByProjectId.get(entry.project_id) || null : null
        let resolvedRate: number | null = null

        if (entry.project_id && positionId) {
          const overrideKey = `${entry.project_id}::${positionId}`
          const override = (overridesByProjectAndPosition.get(overrideKey) || [])
            .filter(
              (row) =>
                (!row.effective_from || row.effective_from <= entry.entry_date) &&
                (!row.effective_to || row.effective_to >= entry.entry_date)
            )
            .sort((a, b) => ((a.effective_from || '') > (b.effective_from || '') ? -1 : 1))[0]
          if (override) {
            resolvedRate = Number(override.hourly_rate) || 0
          }
        }

        if (resolvedRate === null && scheduleId && positionId) {
          const scheduleRate = scheduleRateByScheduleAndPosition.get(`${scheduleId}::${positionId}`)
          if (typeof scheduleRate === 'number') {
            resolvedRate = scheduleRate
          }
        }

        const hourlyRate = snapshotRate ?? resolvedRate ?? 0

        entriesWithRates.push({
          id: entry.id,
          employee_id: entry.employee_id || null,
          employee_name: entry.employee_name,
          entry_date: entry.entry_date,
          project_number: entry.project_number,
          project_id: entry.project_id,
          phase_name: entry.phase_name,
          hours: Number(entry.hours) || 0,
          notes: entry.notes || null,
          hourly_rate: hourlyRate,
          amount: (Number(entry.hours) || 0) * hourlyRate,
          project_name: entry.projects?.name || '',
          is_rate_unresolved: snapshotRate === undefined && resolvedRate === null,
        })
      }

      const phases = entriesWithRates.reduce(
        (acc, entry) => {
          const phaseKey = entry.phase_name
          if (!acc[phaseKey]) {
            acc[phaseKey] = {
              phase_name: entry.phase_name,
              employees: {} as Record<
                string,
                { employee_name: string; entries: ProjectBillablesEntry[]; total: number }
              >,
              total: 0,
            }
          }

          const empKey = entry.employee_name
          if (!acc[phaseKey].employees[empKey]) {
            acc[phaseKey].employees[empKey] = {
              employee_name: entry.employee_name,
              entries: [],
              total: 0,
            }
          }

          acc[phaseKey].employees[empKey].entries.push(entry)
          acc[phaseKey].employees[empKey].total += entry.amount
          acc[phaseKey].total += entry.amount
          return acc
        },
        {} as Record<
          string,
          {
            phase_name: string
            employees: Record<
              string,
              { employee_name: string; entries: ProjectBillablesEntry[]; total: number }
            >
            total: number
          }
        >
      )

      const grandTotal = Object.values(phases).reduce((sum, phase) => sum + phase.total, 0)

      return {
        phases,
        grandTotal,
        projectName: entriesWithRates[0]?.project_name || project?.name || '',
      }
    },
    enabled: !!normalizedProjectNumber,
  })

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['project-expenses', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) {
        return [] as ProjectExpenseRow[]
      }

      const [byNumber, byProjectId] = await Promise.all([
        supabase
          .from('project_expenses')
          .select(
            'id, source_entity_type, source_entity_id, vendor_name, expense_date, description, fee_amount, markup_pct, amount_to_charge, is_reimbursable, status, billing_status, invoice_number, project_number, subcontract_contract_id, source_active'
          )
          .eq('project_number', projectNumber)
          .neq('source_active', false)
          .order('expense_date', { ascending: false }),
        supabase
          .from('project_expenses')
          .select(
            'id, source_entity_type, source_entity_id, vendor_name, expense_date, description, fee_amount, markup_pct, amount_to_charge, is_reimbursable, status, billing_status, invoice_number, project_number, subcontract_contract_id, source_active'
          )
          .eq('project_id', projectId as never)
          .neq('source_active', false)
          .order('expense_date', { ascending: false }),
      ])

      if (byNumber.error) throw byNumber.error
      if (byProjectId.error) throw byProjectId.error

      const merged = new Map<number, ProjectExpenseRow>()
      ;[
        ...((byNumber.data as ProjectExpenseRow[] | null) || []),
        ...((byProjectId.data as ProjectExpenseRow[] | null) || []),
      ].forEach((row) => {
        merged.set(row.id, { ...row, qb_vendor_name: null })
      })

      const contractLaborRows = await supabase
        .from('contract_labor')
        .select('qb_expense_id, vendor_name')
        .or(`project_number.eq.${projectNumber},project_id.eq.${projectId}`)

      if (contractLaborRows.error) throw contractLaborRows.error

      const qbVendorByExpenseId = new Map<string, string>()
      ;((contractLaborRows.data as Array<{ qb_expense_id: string | null; vendor_name: string | null }> | null) || [])
        .forEach((row) => {
          const key = (row.qb_expense_id || '').trim()
          if (!key) return
          qbVendorByExpenseId.set(key, row.vendor_name || '')
        })

      return Array.from(merged.values())
        .map((row) => {
          if (row.source_entity_type !== 'contract_labor') return row
          return {
            ...row,
            qb_vendor_name: qbVendorByExpenseId.get((row.source_entity_id || '').trim()) || null,
          }
        })
        .sort((a, b) =>
        (b.expense_date || '').localeCompare(a.expense_date || '')
      )
    },
    enabled: !!normalizedProjectNumber,
  })

  const { data: subcontractContracts, isLoading: loadingSubcontractContracts } = useQuery({
    queryKey: ['subcontract-contracts', normalizedProjectNumber, projectId],
    queryFn: async () => {
      const projectNumber = normalizedProjectNumber
      if (!projectNumber) return [] as SubcontractContractRow[]

      const [byNumber, byProjectId] = await Promise.all([
        supabase
          .from('subcontract_contracts' as never)
          .select('*')
          .eq('project_number' as never, projectNumber as never)
          .order('created_at' as never, { ascending: false }),
        supabase
          .from('subcontract_contracts' as never)
          .select('*')
          .eq('project_id' as never, projectId as never)
          .order('created_at' as never, { ascending: false }),
      ])
      if (byNumber.error) throw byNumber.error
      if (byProjectId.error) throw byProjectId.error

      const merged = new Map<number, SubcontractContractRow>()
      ;[
        ...((byNumber.data as SubcontractContractRow[] | null) || []),
        ...((byProjectId.data as SubcontractContractRow[] | null) || []),
      ].forEach((row) => merged.set(row.id, row))
      return Array.from(merged.values()).sort(
        (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
      )
    },
    enabled: !!normalizedProjectNumber,
  })

  const contractSummaries = useMemo(() => {
    const paidByContractId = new Map<number, number>()
    ;(expenses || []).forEach((expense) => {
      if (!expense.subcontract_contract_id) return
      if (expense.is_reimbursable) return
      const next = (paidByContractId.get(expense.subcontract_contract_id) || 0) + (Number(expense.fee_amount) || 0)
      paidByContractId.set(expense.subcontract_contract_id, next)
    })

    return (subcontractContracts || []).map((contract) => {
      const paidToDate = Number((paidByContractId.get(contract.id) || 0).toFixed(2))
      const originalAmount = Number(contract.original_amount) || 0
      const outstandingAmount = Number((originalAmount - paidToDate).toFixed(2))
      return {
        ...contract,
        paid_to_date: paidToDate,
        outstanding_amount: outstandingAmount,
      }
    })
  }, [expenses, subcontractContracts])

  const getBillablePhaseCollapseKey = (phaseName: string) =>
    `${normalizedProjectNumber}::${selectedBillablesMonth}::${phaseName}`

  const toggleBillablePhaseCollapsed = (phaseName: string) => {
    const phaseKey = getBillablePhaseCollapseKey(phaseName)
    setCollapsedBillablePhases((prev) => ({
      ...prev,
      [phaseKey]: !(prev[phaseKey] ?? false),
    }))
  }

  // Fetch permits
  const { data: permits, isLoading: loadingPermits } = useQuery({
    queryKey: ['project-permits', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_permits')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Tables<'project_permits'>[]
    },
  })

  const { data: agencyCatalog } = useQuery({
    queryKey: ['agency-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_catalog' as never)
        .select('id, code, name, is_active, sort_order')
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
        .select('id, agency_id, code, name, description, is_active, sort_order')
        .eq('is_active' as never, true as never)
        .order('agency_id', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return ((data as PermitCatalogRow[] | null) || []) as PermitCatalogRow[]
    },
  })

  const { data: templateCatalog } = useQuery({
    queryKey: ['application-template-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('application_template_catalog' as never)
        .select('id, agency_id, permit_id, code, name, storage_path, is_active')
        .eq('is_active' as never, true as never)
        .order('agency_id', { ascending: true })
        .order('name', { ascending: true })
      if (error) throw error
      return ((data as ApplicationTemplateRow[] | null) || []) as ApplicationTemplateRow[]
    },
  })

  const { data: projectAgencySelections } = useQuery({
    queryKey: ['project-agencies', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_agencies' as never)
        .select('id, project_id, agency_id, is_selected')
        .eq('project_id' as never, projectId as never)
      if (error) throw error
      return ((data as ProjectAgencyRow[] | null) || []) as ProjectAgencyRow[]
    },
    enabled: Number.isFinite(projectId),
  })

  const { data: projectPermitSelections } = useQuery({
    queryKey: ['project-permit-selections', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_permit_selections' as never)
        .select('id, project_id, project_agency_id, permit_id, permit_identifier, status, is_selected')
        .eq('project_id' as never, projectId as never)
      if (error) throw error
      return ((data as ProjectPermitSelectionRow[] | null) || []) as ProjectPermitSelectionRow[]
    },
    enabled: Number.isFinite(projectId),
  })

  const { data: requiredItemCatalog } = useQuery({
    queryKey: ['permit-required-item-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permit_required_item_catalog' as never)
        .select('id, permit_id, code, name, item_type, responsibility, default_required, application_template_id, sort_order')
        .eq('is_active' as never, true as never)
        .order('permit_id', { ascending: true })
        .order('sort_order', { ascending: true })
      if (error) throw error
      return ((data as PermitRequiredItemCatalogRow[] | null) || []) as PermitRequiredItemCatalogRow[]
    },
  })

  const { data: projectRequiredItems } = useQuery({
    queryKey: ['project-required-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_required_items' as never)
        .select('id, project_id, project_permit_selection_id, required_item_catalog_id, code, name, item_type, responsibility, is_required, status, source_url, output_file_url, notes, created_at, updated_at')
        .eq('project_id' as never, projectId as never)
        .order('created_at', { ascending: true })
      if (error) throw error
      return ((data as ProjectRequiredItemRow[] | null) || []) as ProjectRequiredItemRow[]
    },
    enabled: Number.isFinite(projectId),
  })

  const { data: applicationRuns } = useQuery({
    queryKey: ['project-application-runs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_application_runs' as never)
        .select('id, project_id, project_permit_selection_id, required_item_id, template_id, status, generated_file_url, resolved_fields, created_at, error_message')
        .eq('project_id' as never, projectId as never)
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data as ApplicationRunRow[] | null) || []) as ApplicationRunRow[]
    },
    enabled: Number.isFinite(projectId),
  })

  const { data: contractLabor, isLoading: loadingContractLabor } = useQuery({
    queryKey: ['project-contract-labor', project?.project_number],
    queryFn: async () => {
      const projectNumber = project?.project_number
      if (!projectNumber) return [] as Tables<'contract_labor'>[]
      const { data, error } = await supabase
        .from('contract_labor')
        .select('*')
        .eq('project_number', projectNumber)
        .order('payment_date', { ascending: false })
      if (error) throw error
      return data as Tables<'contract_labor'>[]
    },
    enabled: !!project?.project_number,
  })

  const contractLaborCost = useMemo(() => {
    if (!contractLabor) return 0
    return contractLabor.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
  }, [contractLabor])

  const contractLaborVendors = useMemo(() => {
    const set = new Set<string>()
    contractLabor?.forEach((entry) => {
      if (entry.vendor_name) set.add(entry.vendor_name)
    })
    return Array.from(set).sort()
  }, [contractLabor])

  const contractLaborFiltered = useMemo(() => {
    const list = contractLabor || []
    return list.filter((entry) => {
      if (contractLaborVendor !== 'all' && entry.vendor_name !== contractLaborVendor) return false
      if (contractLaborSearch) {
        const query = contractLaborSearch.toLowerCase()
        const matches =
          entry.vendor_name.toLowerCase().includes(query) ||
          (entry.description || '').toLowerCase().includes(query)
        if (!matches) return false
      }
      if (contractLaborStart || contractLaborEnd) {
        if (!entry.payment_date && !(entry.year && entry.month)) return false
        const entryDate = entry.payment_date
          ? new Date(entry.payment_date)
          : new Date(Date.UTC(entry.year || 0, (entry.month || 1) - 1, 1))
        if (contractLaborStart && entryDate < new Date(contractLaborStart)) return false
        if (contractLaborEnd) {
          const end = new Date(contractLaborEnd)
          end.setHours(23, 59, 59, 999)
          if (entryDate > end) return false
        }
      }
      return true
    })
  }, [contractLabor, contractLaborVendor, contractLaborSearch, contractLaborStart, contractLaborEnd])

  const contractLaborSorted = useMemo(() => {
    const list = [...contractLaborFiltered]
    list.sort((a, b) => {
      let aVal: string | number | Date = ''
      let bVal: string | number | Date = ''
      if (contractLaborSort === 'vendor') {
        aVal = a.vendor_name
        bVal = b.vendor_name
      } else if (contractLaborSort === 'amount') {
        aVal = Number(a.amount) || 0
        bVal = Number(b.amount) || 0
      } else {
        const aDate = a.payment_date
          ? new Date(a.payment_date)
          : new Date(Date.UTC(a.year || 0, (a.month || 1) - 1, 1))
        const bDate = b.payment_date
          ? new Date(b.payment_date)
          : new Date(Date.UTC(b.year || 0, (b.month || 1) - 1, 1))
        aVal = aDate
        bVal = bDate
      }
      if (aVal < bVal) return contractLaborSortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return contractLaborSortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [contractLaborFiltered, contractLaborSort, contractLaborSortDir])

  const handleContractLaborSort = (field: 'vendor' | 'date' | 'amount') => {
    if (contractLaborSort === field) {
      setContractLaborSortDir(contractLaborSortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setContractLaborSort(field)
      setContractLaborSortDir('asc')
    }
  }

  const openContractLaborEdit = (entry: Tables<'contract_labor'>) => {
    setEditingContractLabor(entry)
    setContractLaborForm({
      vendor_name: entry.vendor_name || '',
      payment_date: entry.payment_date || '',
      description: entry.description || '',
      amount: entry.amount ? formatCurrency(Number(entry.amount)) : '',
      project_number: entry.project_number || '',
    })
    setIsContractLaborEditOpen(true)
  }

  const closeContractLaborEdit = () => {
    setIsContractLaborEditOpen(false)
    setEditingContractLabor(null)
  }

  const normalizeContractLaborAmount = (value: string) => value.replace(/[^0-9.]/g, '')

  const handleContractLaborSave = async () => {
    if (!editingContractLabor) return
    setIsContractLaborSaving(true)
    try {
      const amountValue = Number(normalizeContractLaborAmount(contractLaborForm.amount))
      const paymentDateValue = contractLaborForm.payment_date || null
      const dateForParts = paymentDateValue ? new Date(paymentDateValue) : null
      const year = dateForParts ? dateForParts.getUTCFullYear() : editingContractLabor.year
      const month = dateForParts ? dateForParts.getUTCMonth() + 1 : editingContractLabor.month
      const projectNumber = contractLaborForm.project_number || null
      const projectId = projectNumber ? projectNumberToId.get(projectNumber) || null : null

      const { error } = await supabase
        .from('contract_labor')
        .update({
          vendor_name: contractLaborForm.vendor_name,
          payment_date: paymentDateValue,
          description: contractLaborForm.description || null,
          amount: amountValue,
          project_number: projectNumber,
          project_id: projectId,
          year: year || null,
          month: month || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, editingContractLabor.id as never)
      if (error) throw error
      closeContractLaborEdit()
    } catch (error) {
      console.error('Failed to update contract labor:', error)
    } finally {
      setIsContractLaborSaving(false)
    }
  }

  const handleContractLaborDelete = async () => {
    if (!editingContractLabor) return
    setIsContractLaborDeleting(true)
    try {
      const { error } = await supabase
        .from('contract_labor')
        .delete()
        .eq('id' as never, editingContractLabor.id as never)
      if (error) throw error
      closeContractLaborEdit()
    } catch (error) {
      console.error('Failed to delete contract labor:', error)
    } finally {
      setIsContractLaborDeleting(false)
    }
  }

  const handleToggleExpenseReimbursable = async (expenseId: number, checked: boolean) => {
    setUpdatingExpenseId(expenseId)
    try {
      const nextBillingStatus: ExpenseBillingStatus = checked ? 'approved' : 'ignored'
      const { error } = await supabase
        .from('project_expenses')
        .update({
          is_reimbursable: checked,
          billing_status: nextBillingStatus,
          status: legacyStatusFromBillingStatus(nextBillingStatus),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', expenseId as never)
      if (error) throw error

      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
      toast.success('Expense updated')
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update expense')
    } finally {
      setUpdatingExpenseId(null)
    }
  }

  const openCreateContractDialog = () => {
    setEditingSubcontractContract(null)
    setContractForm({
      vendor_name: '',
      description: '',
      original_amount: '',
      status: 'active',
      start_date: '',
      end_date: '',
    })
    setIsContractDialogOpen(true)
  }

  const openEditContractDialog = (contract: SubcontractContractRow) => {
    setEditingSubcontractContract(contract)
    setContractForm({
      vendor_name: contract.vendor_name || '',
      description: contract.description || '',
      original_amount: String(Number(contract.original_amount) || 0),
      status: contract.status || 'active',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
    })
    setIsContractDialogOpen(true)
  }

  const closeContractDialog = () => {
    setIsContractDialogOpen(false)
    setEditingSubcontractContract(null)
    setIsDeletingContract(false)
    setIsSavingContract(false)
  }

  const saveContract = async () => {
    const vendorName = contractForm.vendor_name.trim()
    const originalAmount = Number(contractForm.original_amount)
    if (!vendorName) {
      toast.error('Vendor is required')
      return
    }
    if (!Number.isFinite(originalAmount) || originalAmount < 0) {
      toast.error('Original amount must be zero or greater')
      return
    }

    setIsSavingContract(true)
    try {
      const payload = {
        project_id: projectId,
        project_number: normalizedProjectNumber,
        vendor_name: vendorName,
        description: contractForm.description.trim() || null,
        original_amount: Number(originalAmount.toFixed(2)),
        status: contractForm.status,
        start_date: contractForm.start_date || null,
        end_date: contractForm.end_date || null,
        updated_at: new Date().toISOString(),
      }

      if (editingSubcontractContract) {
        const { error } = await supabase
          .from('subcontract_contracts' as never)
          .update(payload as never)
          .eq('id' as never, editingSubcontractContract.id as never)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subcontract_contracts' as never).insert(payload as never)
        if (error) throw error
      }

      queryClient.invalidateQueries({
        queryKey: ['subcontract-contracts', normalizedProjectNumber, projectId],
      })
      toast.success(editingSubcontractContract ? 'Contract updated' : 'Contract created')
      closeContractDialog()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save contract')
    } finally {
      setIsSavingContract(false)
    }
  }

  const deleteContract = async () => {
    if (!editingSubcontractContract) return
    setIsDeletingContract(true)
    try {
      const { error } = await supabase
        .from('subcontract_contracts' as never)
        .delete()
        .eq('id' as never, editingSubcontractContract.id as never)
      if (error) throw error
      queryClient.invalidateQueries({
        queryKey: ['subcontract-contracts', normalizedProjectNumber, projectId],
      })
      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
      toast.success('Contract deleted')
      closeContractDialog()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete contract')
    } finally {
      setIsDeletingContract(false)
    }
  }

  const linkExpenseToContract = async (expenseId: number, contractId: number | null) => {
    setUpdatingExpenseContractId(expenseId)
    try {
      const { error } = await supabase
        .from('project_expenses')
        .update({
          subcontract_contract_id: contractId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', expenseId as never)
      if (error) throw error

      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
      toast.success('Expense contract link updated')
    } catch (error) {
      toast.error((error as Error).message || 'Failed to link expense to contract')
    } finally {
      setUpdatingExpenseContractId(null)
    }
  }

  useEffect(() => {
    if (!expenses) return
    setExpenseChargeDrafts(() => {
      const next: Record<number, string> = {}
      expenses.forEach((expense) => {
        next[expense.id] = formatCurrency(Number(expense.amount_to_charge) || 0)
      })
      return next
    })
  }, [expenses])

  const parseCurrencyValue = (value: string) => {
    const normalized = value.replace(/[^0-9.-]/g, '')
    const numeric = Number(normalized)
    return Number.isFinite(numeric) ? numeric : NaN
  }

  useEffect(() => {
    return () => {
      Object.values(expenseChargeSaveTimers.current).forEach((timer) => clearTimeout(timer))
      expenseChargeSaveTimers.current = {}
    }
  }, [])

  const updateExpenseAmountToCharge = async (
    expenseId: number,
    feeAmount: number,
    amountToCharge: number
  ) => {
    const safeFee = Number(feeAmount) || 0
    const safeAmount = Math.max(0, Number(amountToCharge) || 0)
    const markupPct =
      safeFee > 0 ? Math.max(0, Number(((safeAmount / safeFee) - 1).toFixed(4))) : 0

    setUpdatingExpenseChargeId(expenseId)
    try {
      const { error } = await supabase
        .from('project_expenses')
        .update({
          markup_pct: markupPct,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', expenseId as never)
      if (error) throw error
      queryClient.invalidateQueries({
        queryKey: ['project-expenses', normalizedProjectNumber, projectId],
      })
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update amount to charge')
    } finally {
      setUpdatingExpenseChargeId(null)
    }
  }

  const applyDefaultExpenseMarkup = async (expenseId: number, feeAmount: number) => {
    const amount = Math.max(0, (Number(feeAmount) || 0) * 1.15)
    setExpenseChargeDrafts((prev) => ({ ...prev, [expenseId]: formatCurrency(amount) }))
    await updateExpenseAmountToCharge(expenseId, feeAmount, amount)
  }

  const scheduleExpenseChargeSave = (expenseId: number, feeAmount: number, draftValue: string) => {
    const parsed = parseCurrencyValue(draftValue)
    if (Number.isNaN(parsed)) return
    if (expenseChargeSaveTimers.current[expenseId]) {
      clearTimeout(expenseChargeSaveTimers.current[expenseId])
    }
    expenseChargeSaveTimers.current[expenseId] = setTimeout(() => {
      void updateExpenseAmountToCharge(expenseId, feeAmount, Math.max(0, Number(parsed.toFixed(2))))
      delete expenseChargeSaveTimers.current[expenseId]
    }, 700)
  }

  const { data: qbServices } = useQuery({
    queryKey: ['qbo-services'],
    queryFn: async () => {
      const response = await fetch('/api/qb-time/items')
      if (!response.ok) {
        throw new Error('Failed to fetch QBO services')
      }
      const payload = await response.json()
      return (payload.items || []) as { id: string; name: string }[]
    },
  })

  useEffect(() => {
    if (!qbServices) return
    const names = qbServices.map((item) => item.name).filter(Boolean)
    setServiceNames(Array.from(new Set(names)))
  }, [qbServices])

  const [isAddingPermit, setIsAddingPermit] = useState(false)
  const [permitAgency, setPermitAgency] = useState<'City of Jacksonville' | 'St. Johns County'>('City of Jacksonville')
  const [permitType, setPermitType] = useState('PLAN APPROVAL')
  const [permitIdentifier, setPermitIdentifier] = useState('')
  const [timeFilterStart, setTimeFilterStart] = useState('')
  const [timeFilterEnd, setTimeFilterEnd] = useState('')
  const [timeFilterEmployee, setTimeFilterEmployee] = useState('all')
  const [timeFilterPhase, setTimeFilterPhase] = useState('all')

  useEffect(() => {
    if (permitAgency === 'City of Jacksonville') {
      setPermitType('PLAN APPROVAL')
    } else if (permitType !== 'COMM' && permitType !== 'MDP') {
      setPermitType('COMM')
    }
  }, [permitAgency, permitType])

  const handleSavePermit = async () => {
    if (!permitIdentifier.trim()) {
      toast.error('Please enter a permit number')
      return
    }

    const { error } = await supabase.from('project_permits').insert({
      project_id: projectId,
      agency: permitAgency,
      permit_type: permitType,
      permit_identifier: permitIdentifier.trim(),
    } as never)

    if (error) {
      toast.error(error.message || 'Failed to save permit')
      return
    }

    toast.success('Permit tracked')
    setIsAddingPermit(false)
    setPermitIdentifier('')
    queryClient.invalidateQueries({ queryKey: ['project-permits', projectId] })
  }

  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [generatingRequiredItemId, setGeneratingRequiredItemId] = useState<number | null>(null)
  const [itemsDialogPermitId, setItemsDialogPermitId] = useState<number | null>(null)
  const [agenciesDialogOpen, setAgenciesDialogOpen] = useState(false)
  const [permitsDialogOpen, setPermitsDialogOpen] = useState(false)
  const [agencyPendingRemoval, setAgencyPendingRemoval] = useState<AgencyCatalogRow | null>(null)

  const agencyById = useMemo(() => {
    const map = new Map<number, AgencyCatalogRow>()
    ;(agencyCatalog || []).forEach((agency) => map.set(agency.id, agency))
    return map
  }, [agencyCatalog])

  const permitById = useMemo(() => {
    const map = new Map<number, PermitCatalogRow>()
    ;(permitCatalog || []).forEach((permit) => map.set(permit.id, permit))
    return map
  }, [permitCatalog])

  const selectedAgencyIds = useMemo(() => {
    return new Set(
      (projectAgencySelections || [])
        .filter((row) => row.is_selected)
        .map((row) => row.agency_id)
    )
  }, [projectAgencySelections])

  const selectedAgencies = useMemo(() => {
    return (agencyCatalog || []).filter((agency) => selectedAgencyIds.has(agency.id))
  }, [agencyCatalog, selectedAgencyIds])

  const selectedPermitByPermitId = useMemo(() => {
    const map = new Map<number, ProjectPermitSelectionRow>()
    ;(projectPermitSelections || [])
      .filter((row) => row.is_selected)
      .forEach((row) => map.set(row.permit_id, row))
    return map
  }, [projectPermitSelections])

  const permitSelectionsById = useMemo(() => {
    const map = new Map<number, ProjectPermitSelectionRow>()
    ;(projectPermitSelections || []).forEach((row) => map.set(row.id, row))
    return map
  }, [projectPermitSelections])

  const requiredItemsBySelectionId = useMemo(() => {
    const map = new Map<number, ProjectRequiredItemRow[]>()
    ;(projectRequiredItems || []).forEach((row) => {
      const list = map.get(row.project_permit_selection_id) || []
      list.push(row)
      map.set(row.project_permit_selection_id, list)
    })
    return map
  }, [projectRequiredItems])

  const materializeRequiredItemsForSelection = async (
    selectionId: number,
    permitId: number
  ) => {
    const catalogRows = (requiredItemCatalog || []).filter((item) => item.permit_id === permitId)
    if (!catalogRows.length) return

    const existingRows = requiredItemsBySelectionId.get(selectionId) || []
    const existingKeys = new Set(
      existingRows.map((row) => `${(row.code || '').trim().toUpperCase()}::${row.name.trim().toUpperCase()}`)
    )

    const inserts = catalogRows
      .filter(
        (row) =>
          !existingKeys.has(`${(row.code || '').trim().toUpperCase()}::${row.name.trim().toUpperCase()}`)
      )
      .map((row) => ({
        project_id: projectId,
        project_permit_selection_id: selectionId,
        required_item_catalog_id: row.id,
        code: row.code,
        name: row.name,
        item_type: row.item_type,
        responsibility: row.responsibility,
        is_required: row.default_required,
        status: 'pending',
      }))

    if (inserts.length) {
      const { error } = await supabase.from('project_required_items' as never).insert(inserts as never)
      if (error) throw error
    }
  }

  const refreshAgencyPermitData = () => {
    queryClient.invalidateQueries({ queryKey: ['project-agencies', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project-permit-selections', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project-required-items', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project-permits', projectId] })
  }

  const toggleAgency = async (agency: AgencyCatalogRow, checked: boolean) => {
    setWorkflowBusy(true)
    try {
      const existing = (projectAgencySelections || []).find((row) => row.agency_id === agency.id)
      if (existing) {
        const { error } = await supabase
          .from('project_agencies' as never)
          .update({ is_selected: checked, updated_at: new Date().toISOString() } as never)
          .eq('id' as never, existing.id as never)
        if (error) throw error
      } else if (checked) {
        const { error } = await supabase.from('project_agencies' as never).insert({
          project_id: projectId,
          agency_id: agency.id,
          is_selected: true,
        } as never)
        if (error) throw error
      }

      if (!checked) {
        const permitIds = (permitCatalog || [])
          .filter((permit) => permit.agency_id === agency.id)
          .map((permit) => permit.id)
        if (permitIds.length) {
          const { error } = await supabase
            .from('project_permit_selections' as never)
            .update({ is_selected: false, updated_at: new Date().toISOString() } as never)
            .eq('project_id' as never, projectId as never)
            .in('permit_id' as never, permitIds as never)
          if (error) throw error
        }
      }

      refreshAgencyPermitData()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update agency selection')
    } finally {
      setWorkflowBusy(false)
    }
  }

  const togglePermit = async (permit: PermitCatalogRow, checked: boolean) => {
    setWorkflowBusy(true)
    try {
      let projectAgency = (projectAgencySelections || []).find((row) => row.agency_id === permit.agency_id)

      if (!projectAgency && checked) {
        const { data: insertedAgency, error: agencyError } = await supabase
          .from('project_agencies' as never)
          .insert({
            project_id: projectId,
            agency_id: permit.agency_id,
            is_selected: true,
          } as never)
          .select('id, project_id, agency_id, is_selected')
          .single()
        if (agencyError) throw agencyError
        projectAgency = insertedAgency as unknown as ProjectAgencyRow
      } else if (projectAgency && checked && !projectAgency.is_selected) {
        const { error } = await supabase
          .from('project_agencies' as never)
          .update({ is_selected: true, updated_at: new Date().toISOString() } as never)
          .eq('id' as never, projectAgency.id as never)
        if (error) throw error
      }

      const existingSelection = (projectPermitSelections || []).find(
        (row) => row.permit_id === permit.id
      )
      let selectionId = existingSelection?.id || null

      if (existingSelection) {
        const { error } = await supabase
          .from('project_permit_selections' as never)
          .update({
            is_selected: checked,
            project_agency_id: projectAgency?.id || existingSelection.project_agency_id,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id' as never, existingSelection.id as never)
        if (error) throw error
      } else if (checked) {
        const { data: insertedSelection, error: selectionError } = await supabase
          .from('project_permit_selections' as never)
          .insert({
            project_id: projectId,
            project_agency_id: projectAgency?.id || null,
            permit_id: permit.id,
            is_selected: true,
            status: 'required',
          } as never)
          .select('id')
          .single()
        if (selectionError) throw selectionError
        selectionId = (insertedSelection as { id: number } | null)?.id || null
      }

      if (checked && selectionId) {
        await materializeRequiredItemsForSelection(selectionId, permit.id)
      }

      refreshAgencyPermitData()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update permit selection')
    } finally {
      setWorkflowBusy(false)
    }
  }

  const generateApplication = async (requiredItemId: number) => {
    setGeneratingRequiredItemId(requiredItemId)
    try {
      const response = await fetch(`/api/projects/${projectId}/applications/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredItemId }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate application')
      }
      const downloadUrl = String(payload.downloadUrl || '')
      const suggestedFileName = String(payload.fileName || `application-${requiredItemId}.pdf`)
      if (downloadUrl) {
        const pdfResponse = await fetch(downloadUrl)
        if (!pdfResponse.ok) {
          throw new Error('Application generated but failed to download PDF')
        }
        const pdfBlob = await pdfResponse.blob()
        const downloadBlobFallback = (blob: Blob, filename: string) => {
          const objectUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = objectUrl
          link.download = filename
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(objectUrl)
        }

        const pickerHost = window as unknown as {
          showSaveFilePicker?: (options?: {
            suggestedName?: string
            types?: Array<{ description?: string; accept?: Record<string, string[]> }>
          }) => Promise<{
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>
              close: () => Promise<void>
            }>
          }>
        }

        if (typeof pickerHost.showSaveFilePicker === 'function') {
          try {
            const handle = await pickerHost.showSaveFilePicker({
              suggestedName: suggestedFileName,
              types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
            })
            const writable = await handle.createWritable()
            await writable.write(pdfBlob)
            await writable.close()
          } catch (pickerError) {
            if (
              pickerError instanceof DOMException &&
              (pickerError.name === 'AbortError' || pickerError.name === 'NotAllowedError')
            ) {
              downloadBlobFallback(pdfBlob, suggestedFileName)
            } else {
              throw pickerError
            }
          }
        } else {
          downloadBlobFallback(pdfBlob, suggestedFileName)
        }
      }

      toast.success('Application generated and saved')
      queryClient.invalidateQueries({ queryKey: ['project-required-items', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-application-runs', projectId] })
    } catch (error) {
      toast.error((error as Error).message || 'Failed to generate application')
    } finally {
      setGeneratingRequiredItemId(null)
    }
  }

  const permitsByAgency = useMemo(() => {
    const map = new Map<number, PermitCatalogRow[]>()
    ;(permitCatalog || []).forEach((permit) => {
      const list = map.get(permit.agency_id) || []
      list.push(permit)
      map.set(permit.agency_id, list)
    })
    return map
  }, [permitCatalog])

  const requiredCatalogById = useMemo(() => {
    const map = new Map<number, PermitRequiredItemCatalogRow>()
    ;(requiredItemCatalog || []).forEach((row) => map.set(row.id, row))
    return map
  }, [requiredItemCatalog])

  const requiredItemsByPermitId = useMemo(() => {
    const map = new Map<number, PermitRequiredItemCatalogRow[]>()
    ;(requiredItemCatalog || []).forEach((row) => {
      const list = map.get(row.permit_id) || []
      list.push(row)
      map.set(row.permit_id, list)
    })
    return map
  }, [requiredItemCatalog])

  const itemsDialogPermit = useMemo(() => {
    if (!itemsDialogPermitId) return null
    return permitById.get(itemsDialogPermitId) || null
  }, [itemsDialogPermitId, permitById])

  const itemsDialogRows = useMemo(() => {
    if (!itemsDialogPermitId) return []
    return requiredItemsByPermitId.get(itemsDialogPermitId) || []
  }, [itemsDialogPermitId, requiredItemsByPermitId])

  const templateById = useMemo(() => {
    const map = new Map<number, ApplicationTemplateRow>()
    ;(templateCatalog || []).forEach((row) => map.set(row.id, row))
    return map
  }, [templateCatalog])

  const visibleRequiredItems = useMemo(() => {
    return (projectRequiredItems || []).filter((item) => {
      const selection = permitSelectionsById.get(item.project_permit_selection_id)
      return Boolean(selection?.is_selected)
    })
  }, [projectRequiredItems, permitSelectionsById])

  const selectedApplicationItems = useMemo(() => {
    return visibleRequiredItems
      .filter((item) => item.is_required && item.item_type === 'application')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [visibleRequiredItems])

  const legacyPermitsOnly = useMemo(() => {
    if ((projectPermitSelections || []).length > 0) return []
    return (permits || []).map((permit) => ({
      agency: permit.agency,
      permit_type: permit.permit_type,
      permit_identifier: permit.permit_identifier,
    }))
  }, [permits, projectPermitSelections])

  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set())

  const toggleInvoice = (invoiceId: number) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev)
      if (next.has(invoiceId)) {
        next.delete(invoiceId)
      } else {
        next.add(invoiceId)
      }
      return next
    })
  }

  const lineItemsByInvoice = useMemo(() => {
    const map = new Map<number, Tables<'invoice_line_items'>[]>()
    invoiceLineItems?.forEach((item) => {
      const list = map.get(item.invoice_id)
      if (list) {
        list.push(item)
      } else {
        map.set(item.invoice_id, [item])
      }
    })
    return map
  }, [invoiceLineItems])

  const timeFilterOptions = useMemo(() => {
    const employees = new Set<string>()
    const phasesSet = new Set<string>()
    timeEntries?.forEach((entry) => {
      if (entry.employee_name) employees.add(entry.employee_name)
      if (entry.phase_name) phasesSet.add(entry.phase_name)
    })
    return {
      employees: Array.from(employees).sort(),
      phases: Array.from(phasesSet).sort(),
    }
  }, [timeEntries])

  const filteredTimeEntries = useMemo(() => {
    if (!timeEntries) return []
    return timeEntries.filter((entry) => {
      if (timeFilterEmployee !== 'all' && entry.employee_name !== timeFilterEmployee) {
        return false
      }
      if (timeFilterPhase !== 'all' && entry.phase_name !== timeFilterPhase) {
        return false
      }
      if (timeFilterStart) {
        const entryDate = new Date(entry.entry_date)
        const startDate = new Date(timeFilterStart)
        if (entryDate < startDate) return false
      }
      if (timeFilterEnd) {
        const entryDate = new Date(entry.entry_date)
        const endDate = new Date(timeFilterEnd)
        endDate.setHours(23, 59, 59, 999)
        if (entryDate > endDate) return false
      }
      return true
    })
  }, [timeEntries, timeFilterEmployee, timeFilterPhase, timeFilterStart, timeFilterEnd])

  const billedByPhaseName = useMemo(() => {
    const totals = new Map<string, number>()
    invoiceLineItems?.forEach((item) => {
      const lineType = (item.line_type || '').toLowerCase()
      if (lineType === 'reimbursable' || lineType === 'adjustment') return
      if (isInvoiceAdjustmentLabel(item.phase_name || '')) return
      const name = (item.phase_name || '').trim().toLowerCase()
      if (!name) return
      const current = totals.get(name) || 0
      totals.set(name, current + (Number(item.amount) || 0))
    })
    return totals
  }, [invoiceLineItems])

  const totalReimbursableInvoicedFromInvoiceLines = useMemo(() => {
    if (!invoiceLineItems) return 0
    return invoiceLineItems.reduce((sum, item) => {
      const lineType = (item.line_type || '').trim().toLowerCase()
      const phaseName = (item.phase_name || '').trim().toLowerCase()
      const isReimbLine =
        lineType === 'reimbursable' ||
        phaseName === 'zreim' ||
        phaseName.startsWith('zreim') ||
        phaseName.includes('reimburs')
      return sum + (isReimbLine ? Number(item.amount) || 0 : 0)
    }, 0)
  }, [invoiceLineItems])

  const totalInvoicedFromInvoices = useMemo(() => {
    if (!invoices) return 0
    return invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0)
  }, [invoices])

  const zReimPhaseNames = useMemo(() => {
    const names = new Set<string>()
    phases?.forEach((phase) => {
      const code = (phase.phase_code || '').trim().toLowerCase()
      const name = (phase.phase_name || '').trim().toLowerCase()
      if (code === 'zreim' && name) names.add(name)
    })
    return names
  }, [phases])

  const isZReimPhaseName = useCallback(
    (phaseName: string | null | undefined) => {
      const normalized = (phaseName || '').trim().toLowerCase()
      if (!normalized) return false
      return (
        normalized === 'zreim' ||
        normalized.startsWith('zreim') ||
        normalized.includes('reimburs') ||
        zReimPhaseNames.has(normalized)
      )
    },
    [zReimPhaseNames]
  )

  const totalBilledByPhases = useMemo(() => {
    if (!phases) return 0
    return phases.reduce((sum, phase) => {
      const billed = billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0
      return sum + billed
    }, 0)
  }, [phases, billedByPhaseName])

  const totalBilledFromInvoices = useMemo(() => {
    if (!invoiceLineItems) return 0
    return invoiceLineItems.reduce((sum, item) => {
      const lineType = (item.line_type || '').trim().toLowerCase()
      if (lineType === 'reimbursable' || lineType === 'adjustment') return sum
      if (isZReimPhaseName(item.phase_name || '')) return sum
      return sum + (Number(item.amount) || 0)
    }, 0)
  }, [invoiceLineItems, isZReimPhaseName])

  // Calculate totals
  const totalFee = phases?.reduce((sum, p) => sum + Number(p.total_fee), 0) || 0
  const totalBilled = phases?.reduce((sum, p) => sum + Number(p.billed_to_date), 0) || 0
  const reimbursableExpenses = useMemo(
    () => (expenses || []).filter((item) => Boolean(item.is_reimbursable)),
    [expenses]
  )
  const totalReimbursableFees = useMemo(
    () => reimbursableExpenses.reduce((sum, item) => sum + (Number(item.fee_amount) || 0), 0),
    [reimbursableExpenses]
  )
  const totalReimbursableCharges = useMemo(
    () => reimbursableExpenses.reduce((sum, item) => sum + (Number(item.amount_to_charge) || 0), 0),
    [reimbursableExpenses]
  )
  const totalReimbursableChargesInvoiced = useMemo(
    () =>
      reimbursableExpenses.reduce((sum, item) => {
        const billingStatus = normalizeExpenseBillingStatus(item)
        const isInvoiced = Boolean(item.invoice_number) || isExpenseInvoicedStatus(billingStatus)
        return sum + (isInvoiced ? Number(item.amount_to_charge) || 0 : 0)
      }, 0),
    [reimbursableExpenses]
  )
  const totalBilledNet = Math.max(0, totalBilledFromInvoices)
  const totalBilledForTable = totalBilledByPhases + totalReimbursableInvoicedFromInvoiceLines
  const totalBilledForDashboard = totalBilledForTable - totalReimbursableCharges
  const totalRemaining = totalFee - totalBilledForDashboard
  const totalRemainingForTable = totalFee - totalBilledByPhases
  const pctComplete = totalFee > 0 ? totalBilledForDashboard / totalFee : 0

  // Calculate labor cost and multiplier
  const totalLaborCost = useMemo(() => {
    if (!allTimeEntries) return contractLaborCost
    const bseLabor = allTimeEntries.reduce((sum, entry) => sum + (Number(entry.labor_cost) || 0), 0)
    return bseLabor + contractLaborCost
  }, [allTimeEntries, contractLaborCost])

  const multiplierNumeratorRevenue = useMemo(() => {
    if (!invoiceLineItems) return 0
    return invoiceLineItems.reduce((sum, item) => {
      const lineType = (item.line_type || '').trim().toLowerCase()
      if (lineType === 'reimbursable' || lineType === 'adjustment') return sum
      if (isZReimPhaseName(item.phase_name || '')) return sum
      return sum + (Number(item.amount) || 0)
    }, 0)
  }, [invoiceLineItems, isZReimPhaseName])

  const nonZReimLaborCost = useMemo(() => {
    if (!allTimeEntries) return 0
    return allTimeEntries.reduce((sum, entry) => {
      if (isZReimPhaseName(entry.phase_name || '')) return sum
      return sum + (Number(entry.labor_cost) || 0)
    }, 0)
  }, [allTimeEntries, isZReimPhaseName])

  const nonReimbursableExpenseCost = useMemo(() => {
    if (!expenses) return 0
    return expenses.reduce((sum, item) => {
      if (item.is_reimbursable) return sum
      return sum + (Number(item.fee_amount) || 0)
    }, 0)
  }, [expenses])

  const multiplierDenominatorCost = nonZReimLaborCost + nonReimbursableExpenseCost

  const laborByPhase = useMemo(() => {
    const totals = new Map<string, { hours: number; cost: number }>()
    allTimeEntries?.forEach((entry) => {
      const name = (entry.phase_name || '').trim().toLowerCase()
      if (!name) return
      const current = totals.get(name) || { hours: 0, cost: 0 }
      totals.set(name, {
        hours: current.hours + (Number(entry.hours) || 0),
        cost: current.cost + (Number(entry.labor_cost) || 0),
      })
    })
    return totals
  }, [allTimeEntries])

  const displayPhases = useMemo(() => {
    if (!phases) return []
    const hasReimb = phases.some((phase) => phase.phase_code === 'ZREIM')
    if (hasReimb) return phases
    return [
      ...phases,
      {
        id: 'zreim-placeholder',
        phase_code: 'ZREIM',
        phase_name: 'Reimbursables',
        billing_type: null,
        total_fee: null,
      },
    ] as Array<Tables<'contract_phases'> | { id: string; phase_code: string; phase_name: string; billing_type: null; total_fee: null }>
  }, [phases])

  const multiplier = canonicalMultiplier

  // Prepare phase chart data
  const phaseChartData = useMemo(() => {
    if (!phases) return []
    return phases.filter((phase) => phase.phase_code !== 'ZREIM').map(phase => {
      const billed = billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0
      const total = Number(phase.total_fee) || 0
      return {
        name: phase.phase_code,
        fullName: phase.phase_name,
        contract: total,
        billed,
        remaining: Math.max(0, total - billed),
      }
    })
  }, [phases, billedByPhaseName])

  // Prepare employee time distribution data
  const employeeTimeData = useMemo(() => {
    if (!allTimeEntries || allTimeEntries.length === 0) return []
    
    const byEmployee: Record<string, number> = {}
    allTimeEntries.forEach(entry => {
      const emp = entry.employee_name || 'Unknown'
      byEmployee[emp] = (byEmployee[emp] || 0) + (entry.hours || 0)
    })
    
    return Object.entries(byEmployee)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
  }, [allTimeEntries])

  const phaseTimeData = useMemo(() => {
    if (!allTimeEntries || allTimeEntries.length === 0) return []

    const byPhase: Record<string, number> = {}
    allTimeEntries.forEach((entry) => {
      const phase = (entry.phase_name || '').trim() || 'Unknown'
      byPhase[phase] = (byPhase[phase] || 0) + (entry.hours || 0)
    })

    return Object.entries(byPhase)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
  }, [allTimeEntries])

  const timeDistributionData = useMemo(
    () => (timeDistributionView === 'employee' ? employeeTimeData : phaseTimeData),
    [timeDistributionView, employeeTimeData, phaseTimeData]
  )

  const totalHours = useMemo(() => {
    return employeeTimeData.reduce((sum, e) => sum + e.hours, 0)
  }, [employeeTimeData])

  if (loadingProject) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found</p>
        <Button asChild className="mt-4">
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">
              {project.project_number} {project.name}
            </h1>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
        </div>
        <Button onClick={() => setIsEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Project
        </Button>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent
          data-size="wide"
          className="max-w-none"
          style={{ width: 900, maxWidth: 900 }}
        >
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update contract phases for this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="grid gap-3 text-sm font-medium text-muted-foreground"
              style={{ gridTemplateColumns: '24px 60px minmax(260px, 1fr) 140px 140px 90px' }}
            >
              <div></div>
              <div>Phase</div>
              <div>Phase Name</div>
              <div>Type</div>
              <div className="text-right">Total Fee</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="space-y-2">
              {phaseDrafts.map((phase, index) => (
                <div
                  key={phase.id ?? `new-${index}`}
                  className="grid items-center gap-3"
                  style={{ gridTemplateColumns: '24px 60px minmax(260px, 1fr) 140px 140px 90px' }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handlePhaseDrop(index)}
                >
                  <button
                    type="button"
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab"
                    draggable
                    onDragStart={() => handlePhaseDragStart(index)}
                    onDragEnd={() => setDragPhaseIndex(null)}
                    aria-label="Reorder phase"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <Input
                    value={phase.phase_code}
                    onChange={(event) =>
                      setPhaseDrafts((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], phase_code: event.target.value }
                        return next
                      })
                    }
                  />
                  <Select
                    value={phase.phase_name}
                    onValueChange={(value) =>
                      setPhaseDrafts((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], phase_name: value }
                        return next
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {phase.phase_name && !serviceNames.includes(phase.phase_name) && (
                        <SelectItem value={phase.phase_name}>{phase.phase_name}</SelectItem>
                      )}
                      {serviceNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={phase.billing_type}
                    onValueChange={(value) =>
                      setPhaseDrafts((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], billing_type: value as 'H' | 'L' }
                        return next
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Lump Sum</SelectItem>
                      <SelectItem value="H">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="text-right"
                    value={phase.total_fee}
                    onChange={(event) => {
                      const value = event.target.value
                      setPhaseDrafts((prev) => {
                        const next = [...prev]
                        next[index] = { ...next[index], total_fee: value }
                        return next
                      })
                    }}
                    onFocus={() => {
                      setPhaseDrafts((prev) => {
                        const next = [...prev]
                        next[index] = {
                          ...next[index],
                          total_fee: normalizeCurrencyInput(next[index].total_fee),
                        }
                        return next
                      })
                    }}
                    onBlur={() => {
                      setPhaseDrafts((prev) => {
                        const next = [...prev]
                        next[index] = {
                          ...next[index],
                          total_fee: formatCurrencyInput(next[index].total_fee),
                        }
                        return next
                      })
                    }}
                  />
                  <div className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleRemovePhaseRow(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {phaseDrafts.length === 0 && (
                <div className="text-center text-muted-foreground">No phases yet.</div>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleAddPhaseRow}>
                Add Phase
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProjectEdits} disabled={isSavingEdits}>
              {isSavingEdits ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="project-info">Project Info</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="agencies-permits">Agencies & Permits</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="billables">Billables</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="time">Labor</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Contract</CardDescription>
                  <CardTitle className="text-xl">{formatCurrency(totalFee)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Revenue</CardDescription>
                  <CardTitle className="text-xl">{formatCurrency(multiplierNumeratorRevenue)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Remaining</CardDescription>
                  <CardTitle className="text-xl">{formatCurrency(totalRemaining)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Project Cost</CardDescription>
                  <CardTitle className="text-xl">
                    {formatCurrency(multiplierDenominatorCost)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Project Multiplier</CardDescription>
                  <CardTitle className="text-xl">
                    {typeof multiplier === 'number' ? multiplier.toFixed(2) + 'x' : '—'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
            {/* Phase Progress Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase Progress</CardTitle>
                <CardDescription>Contract amount vs billed-to-date by phase</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPhases || loadingAllTime ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : phaseChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={phaseChartData} layout="vertical" margin={{ left: 20, right: 140 }}>
                      <CartesianGrid horizontal={false} vertical={false} />
                      <XAxis type="number" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={60} interval={0} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(Number(value))}
                        labelFormatter={(label) => {
                          const phase = phaseChartData.find(p => p.name === label)
                          return phase?.fullName || label
                        }}
                      />
                      <Bar dataKey="billed" stackId="progress" fill="#000000" name="Billed" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="remaining" stackId="progress" fill="#d4d4d4" name="Remaining" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="fullName" position="right" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No phase data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Time Distribution */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Time Distribution</CardTitle>
                    <CardDescription>
                      Total hours by {timeDistributionView} ({formatHours(totalHours)} total)
                    </CardDescription>
                  </div>
                  <Select
                    value={timeDistributionView}
                    onValueChange={(value) =>
                      setTimeDistributionView(value as 'employee' | 'phase')
                    }
                  >
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="phase">Phase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAllTime ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : timeDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={timeDistributionData}
                        dataKey="hours"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name }) => `${name}`}
                        labelLine={true}
                      >
                        {timeDistributionData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => formatHours(Number(value))}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No time entry data available
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="project-info" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allKeys = hasDynamicProjectInfoSchema
                      ? dynamicProjectInfoSections.map(s => `schema-${s.id}`)
                      : PROJECT_INFO_GROUPS.map(g => `legacy-${g.title}`)
                    const newState: Record<string, boolean> = {}
                    allKeys.forEach(key => { newState[key] = true })
                    setExpandedProjectInfoSections(newState)
                  }}
                >
                  Expand All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allKeys = hasDynamicProjectInfoSchema
                      ? dynamicProjectInfoSections.map(s => `schema-${s.id}`)
                      : PROJECT_INFO_GROUPS.map(g => `legacy-${g.title}`)
                    const newState: Record<string, boolean> = {}
                    allKeys.forEach(key => { newState[key] = false })
                    setExpandedProjectInfoSections(newState)
                  }}
                >
                  Collapse All
                </Button>
              </div>
              <Button
                onClick={() =>
                  hasDynamicProjectInfoSchema
                    ? saveProjectInfoDynamic.mutate()
                    : saveProjectInfo.mutate()
                }
                disabled={
                  hasDynamicProjectInfoSchema
                    ? saveProjectInfoDynamic.isPending || !projectInfoDynamicInitialized
                    : saveProjectInfo.isPending || !projectInfoFormInitialized
                }
              >
                {hasDynamicProjectInfoSchema
                  ? saveProjectInfoDynamic.isPending
                    ? 'Saving...'
                    : 'Save Project Info'
                  : saveProjectInfo.isPending
                    ? 'Saving...'
                    : 'Save Project Info'}
              </Button>
            </div>
            {hasDynamicProjectInfoSchema
              ? dynamicProjectInfoSections.map((section) => {
                  const sectionKey = `schema-${section.id}`
                  const isExpanded = expandedProjectInfoSections[sectionKey] ?? true
                  return (
                    <Card key={`schema-section-${section.id}`}>
                      <CardHeader className="pb-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left"
                          onClick={() => toggleProjectInfoSection(sectionKey)}
                          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                        >
                          <CardTitle>{section.title}</CardTitle>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </CardHeader>
                      {isExpanded ? (
                        <CardContent className="p-4 pt-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[320px]">Field</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="w-[630px]">Description</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {section.fields.map((field) => (
                                <TableRow key={`schema-field-${field.id}`}>
                                  <TableCell className="w-[320px] font-medium align-top">
                                    {field.label}
                                  </TableCell>
                                  <TableCell className="align-top">
                                    {renderDynamicProjectInfoFieldControl(field)}
                                  </TableCell>
                                  <TableCell className="w-[630px] align-top text-sm text-muted-foreground">
                                    {field.description?.trim() ? field.description : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      ) : null}
                    </Card>
                  )
                })
              : null}
            {hasDynamicProjectInfoSchema && dynamicProjectInfoSections.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No active Project Info fields are configured in Settings.
                </CardContent>
              </Card>
            ) : null}
            {!hasDynamicProjectInfoSchema
              ? PROJECT_INFO_GROUPS.map((group) => {
                  const sectionKey = `legacy-${group.title}`
                  const isExpanded = expandedProjectInfoSections[sectionKey] ?? true
                  return (
                    <Card key={group.title}>
                      <CardHeader className="pb-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left"
                          onClick={() => toggleProjectInfoSection(sectionKey)}
                          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                        >
                          <CardTitle>{group.title}</CardTitle>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </CardHeader>
                      {isExpanded ? (
                        <CardContent className="p-4 pt-0">
                          <Table>
                            <TableBody>
                              {group.fields.map((field) => (
                                <TableRow key={`${group.title}-${field.label}-${field.key}`}>
                                  <TableCell className="w-[320px] font-medium">{field.label}</TableCell>
                                  <TableCell>{renderProjectInfoFieldControl(field)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      ) : null}
                    </Card>
                  )
                })
              : null}
          </div>
        </TabsContent>

        <TabsContent value="agencies-permits" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Agencies</CardTitle>
                    <CardDescription>
                      Agencies currently selected for this project.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAgenciesDialogOpen(true)}
                    disabled={workflowBusy}
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {selectedAgencies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedAgencies.map((agency) => (
                      <Badge key={agency.id} variant="secondary">
                        {agency.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No agencies selected.</div>
                )}
              </CardContent>
            </Card>

            <Dialog open={agenciesDialogOpen} onOpenChange={setAgenciesDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Agencies</DialogTitle>
                  <DialogDescription>
                    Add or remove agencies assigned to this project.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {(agencyCatalog || []).map((agency) => {
                    const isSelected = selectedAgencyIds.has(agency.id)
                    return (
                      <div
                        key={`agency-editor-${agency.id}`}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-medium">{agency.name}</div>
                          <div className="text-xs text-muted-foreground">{agency.code}</div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? 'destructive' : 'default'}
                          disabled={workflowBusy}
                          onClick={() => {
                            if (isSelected) {
                              setAgencyPendingRemoval(agency)
                            } else {
                              void toggleAgency(agency, true)
                            }
                          }}
                        >
                          {isSelected ? 'Remove' : 'Add'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAgenciesDialogOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
              open={Boolean(agencyPendingRemoval)}
              onOpenChange={(open) => {
                if (!open) setAgencyPendingRemoval(null)
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Are you sure?</DialogTitle>
                  <DialogDescription>
                    Remove {agencyPendingRemoval?.name || 'this agency'} from this project?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAgencyPendingRemoval(null)}
                    disabled={workflowBusy}
                  >
                    No
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={workflowBusy}
                    onClick={() => {
                      if (!agencyPendingRemoval) return
                      const agency = agencyPendingRemoval
                      setAgencyPendingRemoval(null)
                      void toggleAgency(agency, false)
                    }}
                  >
                    Yes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Permits By Agency</CardTitle>
                    <CardDescription>
                      Permits currently selected for this project.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPermitsDialogOpen(true)}
                    disabled={workflowBusy || selectedAgencies.length === 0}
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {selectedAgencies.map((agency) => {
                  const agencyPermits = permitsByAgency.get(agency.id) || []
                  const selectedPermits = agencyPermits.filter((permit) =>
                    selectedPermitByPermitId.has(permit.id)
                  )
                  if (!selectedPermits.length) return null
                  return (
                    <div key={agency.id} className="rounded-md border">
                      <div className="border-b px-3 py-2 text-sm font-semibold">{agency.name}</div>
                      <div className="flex flex-wrap gap-2 p-3">
                        {selectedPermits.map((permit) => (
                          <Badge key={`${agency.id}-selected-permit-${permit.id}`} variant="secondary">
                            {permit.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {selectedAgencies.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Select at least one agency before managing permits.
                  </div>
                ) : null}
                {legacyPermitsOnly.length > 0 && (
                  <div className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900">
                    Legacy permits exist in `project_permits` and are shown below for compatibility until fully migrated.
                    <div className="mt-2 space-y-1">
                      {legacyPermitsOnly.map((permit) => (
                        <div key={`${permit.agency}-${permit.permit_type}-${permit.permit_identifier}`}>
                          {permit.agency} - {permit.permit_type} - {permit.permit_identifier}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={permitsDialogOpen} onOpenChange={setPermitsDialogOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Edit Permits</DialogTitle>
                  <DialogDescription>
                    Add or remove permits for selected agencies. Use View to preview required items before adding.
                  </DialogDescription>
                </DialogHeader>
                {selectedAgencies.length > 0 ? (
                  <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
                    {selectedAgencies.map((agency) => {
                      const agencyPermits = permitsByAgency.get(agency.id) || []
                      if (!agencyPermits.length) return null
                      return (
                        <div key={`permit-editor-${agency.id}`} className="rounded-md border">
                          <div className="border-b px-3 py-2 text-sm font-semibold">{agency.name}</div>
                          <div className="space-y-2 p-3">
                            {agencyPermits.map((permit) => {
                              const selection = selectedPermitByPermitId.get(permit.id)
                              const itemCount = selection
                                ? (requiredItemsBySelectionId.get(selection.id) || []).length
                                : 0
                              return (
                                <div
                                  key={`permit-editor-${agency.id}-${permit.id}`}
                                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">{permit.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {itemCount} required items generated
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setItemsDialogPermitId(permit.id)}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={selection ? 'destructive' : 'default'}
                                      disabled={workflowBusy}
                                      onClick={() => void togglePermit(permit, !Boolean(selection))}
                                    >
                                      {selection ? 'Remove' : 'Add'}
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Select at least one agency first, then return here to manage permits.
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPermitsDialogOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={Boolean(itemsDialogPermitId)}
              onOpenChange={(open) => {
                if (!open) setItemsDialogPermitId(null)
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {itemsDialogPermit ? `${itemsDialogPermit.name} Required Items` : 'Required Items'}
                  </DialogTitle>
                  <DialogDescription>
                    Checklist configured for this permit in the catalog.
                  </DialogDescription>
                </DialogHeader>
                {itemsDialogRows.length > 0 ? (
                  <div className="max-h-[420px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[70px]">#</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-[130px]">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsDialogRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.sort_order}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="uppercase text-xs">{row.item_type}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No required items configured for this permit.</p>
                )}
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Required Items</CardTitle>
                <CardDescription>
                  Checklist of deliverables across selected permits.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permit</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Generated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRequiredItems.map((item) => {
                      const selection = permitSelectionsById.get(item.project_permit_selection_id)
                      const permit = selection ? permitById.get(selection.permit_id) : null
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{permit?.name || 'Unknown Permit'}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="uppercase text-xs">{item.item_type}</TableCell>
                          <TableCell className="text-right">
                            {item.output_file_url ? (
                              <Button asChild variant="outline" size="sm">
                                <a href={item.output_file_url} target="_blank" rel="noreferrer">
                                  Download
                                </a>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {visibleRequiredItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No required items yet. Select permits above to materialize checklist items.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="applications" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Applications To Generate</CardTitle>
                <CardDescription>
                  Generates downloadable application PDFs from mapped project data.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application Item</TableHead>
                      <TableHead>Permit</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedApplicationItems.map((item) => {
                      const selection = permitSelectionsById.get(item.project_permit_selection_id)
                      const permit = selection ? permitById.get(selection.permit_id) : null
                      const requiredCatalog = item.required_item_catalog_id
                        ? requiredCatalogById.get(item.required_item_catalog_id)
                        : null
                      const template = requiredCatalog?.application_template_id
                        ? templateById.get(requiredCatalog.application_template_id)
                        : null
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{permit?.name || 'Unknown Permit'}</TableCell>
                          <TableCell>
                            {template ? (
                              <div>
                                <div className="font-medium">{template.name}</div>
                                <div className="text-xs text-muted-foreground">{template.code}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">No template</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'generated' ? 'default' : 'secondary'}>
                              {item.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={generatingRequiredItemId === item.id || !template}
                                onClick={() => void generateApplication(item.id)}
                              >
                                {generatingRequiredItemId === item.id ? 'Generating...' : 'Generate'}
                              </Button>
                              {item.output_file_url ? (
                                <Button asChild size="sm">
                                  <a href={item.output_file_url} target="_blank" rel="noreferrer">
                                    Download
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {selectedApplicationItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No application-type required items are selected yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Application Run History</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Field Count</TableHead>
                      <TableHead className="text-right">Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(applicationRuns || []).map((run) => {
                      const template = run.template_id ? templateById.get(run.template_id) : null
                      return (
                        <TableRow key={run.id}>
                          <TableCell>{formatDateTime(run.created_at)}</TableCell>
                          <TableCell>{template?.name || 'Unknown Template'}</TableCell>
                          <TableCell>
                            <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {Object.keys(run.resolved_fields || {}).length}
                          </TableCell>
                          <TableCell className="text-right">
                            {run.generated_file_url ? (
                              <Button asChild variant="outline" size="sm">
                                <a href={run.generated_file_url} target="_blank" rel="noreferrer">
                                  Download
                                </a>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {applicationRuns?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No generated applications yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="phases" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {loadingPhases ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Total Fee</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Total Labor</TableHead>
                      <TableHead className="text-right">Total Labor Cost</TableHead>
                      <TableHead className="text-right">Phase Multiplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayPhases.map((phase) => (
                      <TableRow key={phase.id}>
                        <TableCell className="font-mono">{phase.phase_code}</TableCell>
                        <TableCell>{phase.phase_name}</TableCell>
                        <TableCell>
                          {phase.billing_type ? (
                            <Badge variant={phase.billing_type === 'H' ? 'outline' : 'secondary'}>
                              {phase.billing_type === 'H' ? 'Hourly' : 'Lump Sum'}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {phase.phase_code === 'ZREIM' ? '—' : formatCurrency(phase.total_fee)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {phase.phase_code === 'ZREIM'
                            ? formatCurrency(totalReimbursableInvoicedFromInvoiceLines)
                            : formatCurrency(
                                billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0
                              )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {phase.phase_code === 'ZREIM'
                            ? '—'
                            : formatCurrency(
                                Number(phase.total_fee) -
                                  (billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0)
                              )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatHours(
                            laborByPhase.get((phase.phase_name || '').trim().toLowerCase())?.hours || 0
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            laborByPhase.get((phase.phase_name || '').trim().toLowerCase())?.cost || 0
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(() => {
                            const laborCost =
                              laborByPhase.get((phase.phase_name || '').trim().toLowerCase())?.cost || 0
                            const billed =
                              billedByPhaseName.get((phase.phase_name || '').trim().toLowerCase()) || 0
                            if (!laborCost) return '—'
                            return (billed / laborCost).toFixed(2) + 'x'
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {phases && phases.length > 0 && (
                      <TableRow className="font-medium bg-muted/20">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(totalFee)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(totalInvoicedFromInvoices)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(totalRemainingForTable)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatHours(
                            Array.from(laborByPhase.values()).reduce((sum, item) => sum + item.hours, 0)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            Array.from(laborByPhase.values()).reduce((sum, item) => sum + item.cost, 0)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          —
                        </TableCell>
                      </TableRow>
                    )}
                    {phases?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No contract phases defined
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billables" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Billables — {selectedBillablesMonthLabel}</h3>
                <p className="text-sm text-muted-foreground">
                  Monthly billable detail for this project
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedBillablesMonth} onValueChange={setSelectedBillablesMonth}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {billablesMonthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Card className="px-4 py-2">
                  <div className="text-sm text-muted-foreground">Project Total</div>
                  <div className="text-xl font-bold">
                    {formatCurrency(projectBillables?.grandTotal || 0)}
                  </div>
                </Card>
              </div>
            </div>

            {loadingProjectBillables ? (
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(Object.keys(projectBillables?.phases || {}).length || 0) === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No time entries found for the selected month
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            {normalizedProjectNumber} {projectBillables?.projectName || project?.name || ''}
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono">
                            {formatCurrency(projectBillables?.grandTotal || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={2} className="bg-muted/20">
                            <div className="space-y-4 py-2 pl-6">
                              {Object.values(projectBillables?.phases || {}).map((phase) => {
                                const phaseCollapseKey = getBillablePhaseCollapseKey(phase.phase_name)
                                const isPhaseCollapsed = collapsedBillablePhases[phaseCollapseKey] ?? false

                                return (
                                  <div key={phase.phase_name} className="space-y-2">
                                    <div className="flex items-center justify-between border-b pb-1">
                                      <button
                                        type="button"
                                        className="flex items-center text-left font-medium text-sm"
                                        onClick={() => toggleBillablePhaseCollapsed(phase.phase_name)}
                                      >
                                        {isPhaseCollapsed ? (
                                          <ChevronRight className="mr-1 h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="mr-1 h-4 w-4" />
                                        )}
                                        {phase.phase_name}
                                      </button>
                                      <span className="font-medium text-sm">{formatCurrency(phase.total)}</span>
                                    </div>
                                    {isPhaseCollapsed ? null : (
                                      <div className="pl-6">
                                        <Table className="w-full table-fixed">
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-[220px]">Employee</TableHead>
                                              <TableHead className="w-[120px]">Date</TableHead>
                                              <TableHead className="w-[100px] text-right">Hours</TableHead>
                                              <TableHead className="w-[120px] text-right">Rate</TableHead>
                                              <TableHead className="w-[120px] text-right">Amount</TableHead>
                                              <TableHead>Notes</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {Object.values(phase.employees).map((emp) => (
                                              <Fragment key={emp.employee_name}>
                                                {emp.entries.map((entry) => (
                                                  <TableRow key={entry.id}>
                                                    <TableCell className="w-[220px]">
                                                      {entry.employee_name}
                                                    </TableCell>
                                                    <TableCell className="w-[120px]">
                                                      {formatDate(entry.entry_date)}
                                                    </TableCell>
                                                    <TableCell className="w-[100px] text-right font-mono">
                                                      {formatHours(entry.hours)}
                                                    </TableCell>
                                                    <TableCell className="w-[120px] text-right font-mono">
                                                      {entry.is_rate_unresolved
                                                        ? 'Unresolved'
                                                        : formatCurrency(entry.hourly_rate)}
                                                    </TableCell>
                                                    <TableCell className="w-[120px] text-right font-mono">
                                                      {formatCurrency(entry.amount)}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                                                      {entry.notes || '—'}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                                <TableRow className="bg-muted/50">
                                                  <TableCell colSpan={4} className="text-right font-medium">
                                                    Total {emp.employee_name}
                                                  </TableCell>
                                                  <TableCell className="text-right font-bold font-mono">
                                                    {formatCurrency(emp.total)}
                                                  </TableCell>
                                                  <TableCell />
                                                </TableRow>
                                              </Fragment>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {loadingInvoices ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[140px]">Invoice #</TableHead>
                      <TableHead className="w-[140px]">Date Issued</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Paid</TableHead>
                      <TableHead className="w-[140px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices?.map((invoice) => {
                      const isExpanded = expandedInvoices.has(invoice.id)
                      const items = lineItemsByInvoice.get(invoice.id) || []
                      return (
                        <Fragment key={invoice.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell>
                              {items.length > 0 ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleInvoice(invoice.id)}
                                  aria-label={isExpanded ? 'Collapse invoice' : 'Expand invoice'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{formatDate(invoice.date_issued)}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.date_paid ? 'default' : 'secondary'}>
                                {invoice.date_paid ? 'Paid' : 'Unpaid'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {invoice.date_paid ? formatDate(invoice.date_paid) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(invoice.amount)}
                            </TableCell>
                          </TableRow>
                          {isExpanded && items.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="p-0">
                                <div className="bg-muted/20 p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead colSpan={2}>Phase</TableHead>
                                        <TableHead></TableHead>
                                        <TableHead></TableHead>
                                        <TableHead className="w-[140px] text-right">Amount</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {items.map((item, index) => (
                                        <TableRow key={`${item.invoice_id}-${index}`}>
                                          <TableCell className="w-[40px]"></TableCell>
                                          <TableCell colSpan={2}>{item.phase_name || 'Unassigned'}</TableCell>
                                          <TableCell></TableCell>
                                          <TableCell></TableCell>
                                          <TableCell className="w-[140px] text-right font-mono">
                                            {formatCurrency(Number(item.amount) || 0)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                    {invoices && invoices.length > 0 && (
                      <TableRow className="font-medium bg-muted/20">
                        <TableCell colSpan={5}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0)
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {invoices?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No invoices yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {loadingTime ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Start Date</div>
                      <Input
                        type="date"
                        value={timeFilterStart}
                        onChange={(event) => setTimeFilterStart(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">End Date</div>
                      <Input
                        type="date"
                        value={timeFilterEnd}
                        onChange={(event) => setTimeFilterEnd(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Employee</div>
                      <Select value={timeFilterEmployee} onValueChange={setTimeFilterEmployee}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="All employees" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {timeFilterOptions.employees.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Phase</div>
                      <Select value={timeFilterPhase} onValueChange={setTimeFilterPhase}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="All phases" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {timeFilterOptions.phases.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTimeFilterStart('')
                        setTimeFilterEnd('')
                        setTimeFilterEmployee('all')
                        setTimeFilterPhase('all')
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTimeEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{formatDate(entry.entry_date)}</TableCell>
                          <TableCell>{entry.employee_name}</TableCell>
                          <TableCell>{entry.phase_name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatHours(entry.hours)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(Number(entry.labor_cost) || 0)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                            {entry.notes || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredTimeEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No time entries
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredTimeEntries.length > 0 && (
                        <TableRow className="font-medium bg-muted/20">
                          <TableCell colSpan={3}>Total</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatHours(
                              filteredTimeEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(
                              filteredTimeEntries.reduce((sum, entry) => sum + (Number(entry.labor_cost) || 0), 0)
                            )}
                          </TableCell>
                          <TableCell colSpan={1}></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {loadingExpenses ? (
                <div className="p-4">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Reimbursable</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead className="text-right">Amount to Charge</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses?.map((expense) => {
                      const billingStatus = normalizeExpenseBillingStatus(expense)
                      const isInvoiced =
                        Boolean(expense.invoice_number) || isExpenseInvoicedStatus(billingStatus)
                      const statusLabel = expense.is_reimbursable
                        ? isInvoiced
                          ? 'Invoiced'
                          : 'To Be Invoiced'
                        : '—'

                      return (
                        <TableRow key={expense.id}>
                          <TableCell>
                            {(expense.source_entity_type === 'contract_labor'
                              ? expense.qb_vendor_name || expense.vendor_name
                              : expense.vendor_name) || '—'}
                          </TableCell>
                          <TableCell>{formatDate(expense.expense_date)}</TableCell>
                          <TableCell>{expense.description || '—'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(Number(expense.fee_amount) || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={Boolean(expense.is_reimbursable)}
                              disabled={updatingExpenseId === expense.id}
                              onCheckedChange={(checked) =>
                                void handleToggleExpenseReimbursable(expense.id, Boolean(checked))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={
                                expense.subcontract_contract_id
                                  ? String(expense.subcontract_contract_id)
                                  : 'unassigned'
                              }
                              disabled={updatingExpenseContractId === expense.id}
                              onValueChange={(value) =>
                                void linkExpenseToContract(
                                  expense.id,
                                  value === 'unassigned' ? null : Number(value)
                                )
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {(subcontractContracts || []).map((contract) => (
                                  <SelectItem key={contract.id} value={String(contract.id)}>
                                    {contract.vendor_name}
                                    {contract.description ? ` - ${contract.description}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {expense.is_reimbursable ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  disabled={updatingExpenseChargeId === expense.id}
                                  onClick={() =>
                                    void applyDefaultExpenseMarkup(expense.id, Number(expense.fee_amount) || 0)
                                  }
                                >
                                  15%
                                </Button>
                                <Input
                                  value={
                                    expenseChargeDrafts[expense.id] ??
                                    formatCurrency(Number(expense.amount_to_charge) || 0)
                                  }
                                  className="h-8 w-[130px] text-right font-mono"
                                  disabled={updatingExpenseChargeId === expense.id}
                                  onChange={(event) => {
                                    const nextValue = event.target.value
                                    setExpenseChargeDrafts((prev) => ({
                                      ...prev,
                                      [expense.id]: nextValue,
                                    }))
                                    scheduleExpenseChargeSave(
                                      expense.id,
                                      Number(expense.fee_amount) || 0,
                                      nextValue
                                    )
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.currentTarget.blur()
                                    }
                                  }}
                                  onBlur={(event) => {
                                    if (expenseChargeSaveTimers.current[expense.id]) {
                                      clearTimeout(expenseChargeSaveTimers.current[expense.id])
                                      delete expenseChargeSaveTimers.current[expense.id]
                                    }
                                    const parsed = parseCurrencyValue(event.target.value)
                                    if (Number.isNaN(parsed)) {
                                      setExpenseChargeDrafts((prev) => ({
                                        ...prev,
                                        [expense.id]: formatCurrency(Number(expense.amount_to_charge) || 0),
                                      }))
                                      return
                                    }
                                    const rounded = Math.max(0, Number(parsed.toFixed(2)))
                                    setExpenseChargeDrafts((prev) => ({
                                      ...prev,
                                      [expense.id]: formatCurrency(rounded),
                                    }))
                                    void updateExpenseAmountToCharge(
                                      expense.id,
                                      Number(expense.fee_amount) || 0,
                                      rounded
                                    )
                                  }}
                                />
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusLabel === 'Invoiced' ? 'default' : 'secondary'}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {expenses && expenses.length > 0 && (
                      <TableRow className="font-medium bg-muted/20">
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            expenses.reduce((sum, item) => sum + (Number(item.fee_amount) || 0), 0)
                          )}
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right font-mono">
                          {formatCurrency(
                            expenses.reduce(
                              (sum, item) =>
                                sum +
                                (item.is_reimbursable ? Number(item.amount_to_charge) || 0 : 0),
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    {expenses?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No expenses
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Subcontract Contracts</CardTitle>
                <CardDescription>
                  Track original amount, paid-to-date, and outstanding by contract.
                </CardDescription>
              </div>
              <Button onClick={openCreateContractDialog}>Add Contract</Button>
            </CardHeader>
            <CardContent className="p-4">
              {loadingSubcontractContracts || loadingExpenses ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Original Amount</TableHead>
                      <TableHead className="text-right">Paid To Date</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractSummaries.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell>{contract.vendor_name}</TableCell>
                        <TableCell>{contract.description || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                            {contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(contract.original_amount) || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(contract.paid_to_date)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(contract.outstanding_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditContractDialog(contract)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {contractSummaries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          No contracts
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Assignments</CardTitle>
                <CardDescription>
                  Manage team members assigned to this project
                </CardDescription>
              </div>
              <Button disabled>Add Team Member</Button>
            </CardHeader>
            <CardContent className="p-4">
              {loadingTeam ? (
                <Skeleton className="h-48 w-full" />
              ) : teamError ? (
                <div className="py-8 text-center text-red-600">
                  Error loading team: {teamError.message}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(teamAssignments || []).map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.profiles?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {assignment.profiles?.email || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.role === 'project_manager' ? 'default' : 'secondary'}>
                            {assignment.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(assignment.assigned_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(teamAssignments || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No team members assigned yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSubcontractContract ? 'Edit Contract' : 'Add Contract'}</DialogTitle>
            <DialogDescription>
              Contracts are unlimited per project/vendor. Link expenses from the Expenses tab.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Vendor</label>
              <Input
                value={contractForm.vendor_name}
                onChange={(event) =>
                  setContractForm((prev) => ({ ...prev, vendor_name: event.target.value }))
                }
                placeholder="Vendor name"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={contractForm.description}
                onChange={(event) =>
                  setContractForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Optional contract description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Original Amount</label>
                <Input
                  value={contractForm.original_amount}
                  onChange={(event) =>
                    setContractForm((prev) => ({ ...prev, original_amount: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={contractForm.status}
                  onValueChange={(value: 'active' | 'closed' | 'cancelled') =>
                    setContractForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="closed">closed</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(event) =>
                    setContractForm((prev) => ({ ...prev, start_date: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={contractForm.end_date}
                  onChange={(event) =>
                    setContractForm((prev) => ({ ...prev, end_date: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            <div>
              {editingSubcontractContract && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void deleteContract()}
                  disabled={isSavingContract || isDeletingContract}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={closeContractDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void saveContract()}
                disabled={isSavingContract || isDeletingContract}
              >
                {isSavingContract ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
