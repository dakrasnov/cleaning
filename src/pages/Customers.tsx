import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCustomersStore } from '@/store/customers'
import { Badge, Btn, Card, Empty, Field, FilterPills, Input, Modal, PageHeader, SearchBar, Select, SkeletonList, Textarea } from '@/components/ui'
import type { Customer } from '@/types'

const CustomerForm = ({ initial, onSave, onClose, onCreateShift }: { initial?: Partial<Customer>; onSave: (d: any) => void; onClose: () => void; onCreateShift?: () => void }) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'active')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [google_maps_link, setMaps] = useState(initial?.google_maps_link ?? '')
  const [price, setPrice] = useState(initial?.price ?? 0)
  const [overhead, setOverhead] = useState(initial?.overhead ?? 0)
  const [comment, setComment] = useState(initial?.comment ?? '')

  const handleSubmit = () => {
    onSave({ name, phone, status, address, google_maps_link, price: Number(price) || 0, overhead: Math.round(Number(overhead) || 0), comment })
  }

  return (
    <div className="space-y-4">
      <Field label="Name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" /></Field>
      <Field label="Phone"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0000" /></Field>
      <Field label="Status">
        <Select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <Field label="Address"><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" /></Field>
      <Field label="Google Maps Link"><Input value={google_maps_link} onChange={e => setMaps(e.target.value)} /></Field>
      <Field label="Price per hour ($)"><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /></Field>
      <Field label="Overhead ($)"><Input type="number" value={overhead} onChange={e => setOverhead(e.target.value)} /></Field>
      <Field label="Comment"><Textarea value={comment} onChange={e => setComment(e.target.value)} /></Field>
      {initial?.id && onCreateShift && (
        <Btn full onClick={onCreateShift}>+ Create Shift</Btn>
      )}
      <div className="flex gap-3 mt-2">
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full onClick={handleSubmit}>{initial?.id ? 'Update' : 'Add'}</Btn>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const { customers, loading, create, update } = useCustomersStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingCustomer, setEditingCustomer] = useState<Customer | Partial<Customer> | null>(null)

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === 'all' || c.status === statusFilter)
  )

  const handleSave = async (data: any) => {
    if (editingCustomer && 'id' in editingCustomer) {
      const result = await update(editingCustomer.id, data)
      if (result) {
        toast.success('Customer updated')
        setEditingCustomer(null)
      }
    } else {
      const result = await create(data)
      if (result) {
        toast.success('Customer added')
        setEditingCustomer(null)
      }
    }
  }

  return (
    <div>
      <PageHeader 
        title="Customers" 
        action={<Btn small onClick={() => setEditingCustomer({})}>+ Add</Btn>} 
      />
      
      <SearchBar value={search} onChange={setSearch} placeholder="Search customers..." />
      
      <FilterPills 
        value={statusFilter} 
        onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All' }, 
          { value: 'active', label: 'Active' }, 
          { value: 'inactive', label: 'Inactive' }
        ]} 
      />

      {loading && <SkeletonList />}
      
      {!loading && filtered.length === 0 && (
        <Empty 
          icon="🏠" 
          title="No Customers" 
          cta="+ Add Customer" 
          onCta={() => setEditingCustomer({})} 
        />
      )}
      
      {!loading && filtered.map(c => (
        <Card key={c.id} onClick={() => setEditingCustomer(c)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-base mb-1" style={{ color: '#0F2041' }}>{c.name}</div>
              <div className="text-sm text-gray-500">{c.phone}</div>
            </div>
            <div className="text-right">
              <Badge status={c.status} />
              <div className="font-bold text-lg mt-1.5" style={{ color: '#00C9A7' }}>${c.price}/hr</div>
            </div>
          </div>
        </Card>
      ))}

      {editingCustomer && (
        <Modal 
          title={('id' in editingCustomer) ? "Edit Customer" : "New Customer"} 
          onClose={() => setEditingCustomer(null)}
        >
          {/* Добавлен key={editingCustomer.id}, чтобы React пересоздавал форму при смене клиента */}
          <CustomerForm
            key={('id' in editingCustomer) ? editingCustomer.id : 'new'}
            initial={editingCustomer}
            onSave={handleSave}
            onClose={() => setEditingCustomer(null)}
            onCreateShift={('id' in editingCustomer) ? () => {
              setEditingCustomer(null)
              navigate(`/shifts?new=1&customer_id=${editingCustomer.id}`)
            } : undefined}
          />
        </Modal>
      )}
    </div>
  )
}
