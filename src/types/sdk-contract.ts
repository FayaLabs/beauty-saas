import type React from 'react'

export interface DashboardSectionProps {
  onNavigate?: (route: string) => void
}

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'textarea'
  | 'boolean'
  | 'select'
  | 'number'
  | 'currency'

export type FormLayout = 'person' | 'service' | 'product'

export interface EntityField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  searchable?: boolean
  showInTable?: boolean
  showInForm?: boolean
  inlineToggle?: boolean
  defaultValue?: unknown
  options?: string[]
  group?: string
  placeholder?: string
}

export interface EntityFieldGroup {
  id: string
  label: string
  columns?: 1 | 2 | 3
  description?: string
}

export interface EntityDetailTab {
  id: string
  label: string
  icon?: string
  component: React.ComponentType<any>
  props?: Record<string, unknown>
}

export interface EntityDef<T = Record<string, unknown>> {
  name: string
  namePlural?: string
  icon: string
  layout?: FormLayout
  displayField: keyof T | string
  subtitleField?: keyof T | string
  defaultSort?: keyof T | string
  defaultSortDir?: 'asc' | 'desc'
  fieldGroups?: EntityFieldGroup[]
  fields: EntityField[]
  detailTabs?: EntityDetailTab[]
  data?: {
    table: string
    schema?: string
    tenantScoped?: boolean
    archetype?: string
    archetypeKind?: string
    searchColumns?: string[]
    filters?: Record<string, unknown>
    defaults?: Record<string, unknown>
  }
}

export interface BeautyBillingPlan {
  id: string
  name: string
  description: string
  features: string[]
  prices: {
    monthly: number
    yearly: number
  }
  popular?: boolean
  /**
   * Structured plan entitlements (feature gates + quantity caps) — the source of
   * truth the SDK access engine reads. Shape mirrors core's PlanEntitlements
   * (kept inline to avoid pulling the SDK type into this app-local contract).
   * `-1` in a limit = unlimited; an absent feature = allowed (plans are additive).
   */
  entitlements?: {
    features?: Record<string, boolean>
    limits?: Record<string, number>
  }
}

export interface BeautyBilling {
  plans: BeautyBillingPlan[]
}

export type PermissionAction = 'read' | 'create' | 'edit' | 'delete'
export type SystemPermission =
  | 'manage_team'
  | 'manage_billing'
  | 'manage_settings'
  | 'manage_permissions'

export interface BeautyPermissionFeature {
  id: string
  label: string
  group: string
}

export interface BeautyPermissionProfile {
  id: string
  name: string
  description?: string
  isSystem: boolean
  systemPermissions: SystemPermission[]
  grants: Record<string, PermissionAction[]>
}

export interface BeautyPermissions {
  features: BeautyPermissionFeature[]
  defaultProfiles: BeautyPermissionProfile[]
}

export interface BeautyCustomPage {
  path: string
  label: string
  icon: string
  position?: number
  component?: React.ComponentType<any>
  permission?: {
    feature: string
    action: PermissionAction
  }
  children?: BeautyCustomPage[]
}

export interface BeautyTheme {
  name: string
  preset: string
  brand: string
  radius: string
  shadow: string
  font: string
  sidebar: Record<string, string>
  content: Record<string, string>
  colors: Record<string, string>
}
