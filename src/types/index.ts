export type CustomerStatus = 'active' | 'inactive'
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave'
export type ShiftStatus = 'open' | 'assigned' | 'confirmed' | 'cancelled' | 'completed'
export type AssignmentStatus = 'assigned' | 'confirmed' | 'completed'

export interface PaymentInfo {
  employee_id: string
  amount: number
  paid: boolean
  confirmed?: boolean
  hour_rate?: number
  overhead?: number
}

export interface Customer {
  id: string
  name: string
  phone: string
  status: CustomerStatus
  address: string
  google_maps_link: string
  price: number
  overhead: number
  comment: string
  created_at: string
}

export interface Employee {
  id: string
  name: string
  phone: string
  email: string
  hire_date: string
  status: EmployeeStatus
  salary: number
  overhead: number
  comment: string
  telegram_chat_id: string
  created_at: string
}

export interface Shift {
  id: string
  customer_id: string
  date: string
  time_start: string
  time_end: string
  comment: string
  status: ShiftStatus
  coef?: number
  customer_rate?: number
  customer_amount?: number
  created_at: string
}

export interface CustomerPayment {
  id: string
  customer_id: string
  shift_id: string
  amount: number
  created_at: string
}

export interface Assignment {
  id: string
  shift_id: string
  employee_ids: string[]
  confirmed_by: string | null
  confirmed_at: string | null
  status: AssignmentStatus
  payment_info: PaymentInfo[]
  created_at: string
}

export interface EmployeeAccrual {
  id: string
  employee_id: string
  shift_id: string
  amount: number
  note: string
  created_at: string
}

export interface EmployeePayment {
  id: string
  employee_id: string
  amount: number
  note: string
  paid_at: string
  created_at: string
}

// Joined/enriched types used in UI
export interface ShiftWithCustomer extends Shift {
  customer: Customer
}

export interface AssignmentWithDetails extends Assignment {
  shift: ShiftWithCustomer
  employees: Employee[]
}
