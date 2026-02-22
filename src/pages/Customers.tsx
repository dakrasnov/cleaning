import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { useCustomersStore } from '@/store/customers'
import { Badge, Btn, Card, Empty, Field, FilterPills, Input, Modal, PageHeader, SearchBar, Select, SkeletonList, Textarea } from '@/components/ui'
import type { Customer } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  status: z.enum(['active', 'inactive']),
  address: z.string().min(1, 'Address is required'),
  google_maps_link: z.string().url('Must be a valid URL').or(z.literal('')),
  price: z.coerce.number().min(0),
  comment: z.string(),
})
type FormData = z.infer<typeof schema>


const CustomerForm = ({ initial, onSave, onClose }: { initial?: any; onSave: (d: any) => void; onClose: () => void }) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'active')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [google_maps_link, setMaps] = useState(initial?.google_maps_link ?? '')
  const [price, setPrice] = useState(initial?.price ?? 0)
  const [comment, setComment] = useState(initial?.comment ?? '')

  const handleSubmit = () => {
    onSave({ name, phone, status, address, google_maps_link, price: Number(price) || 0, comment })
  }

  return (
    <div>
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
      <Field label="Price ($)"><Input type="number" value={price} onChange={e => setPrice(e.target.value)} /></Field>
      <Field label="Comment"><Textarea value={comment} onChange={e => setComment(e.target.value)} /></Field>
      <div className="flex gap-3 mt-2">
        <Btn variant="secondary" full onClick={onClose}>Cancel</Btn>
        <Btn full onClick={handleSubmit}>Add Customer</Btn>
      </div>
    </div>
  )
}


export default function CustomersPage() {
  const navigate = useNavigate()
  const { customers, loading, create, update } = useCustomersStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === 'all' || c.status === statusFilter)
  )



   const handleCreate = async (data: any) => {
     console.log('form data:', data)
     const result = await create({ ...data, price: Number(data.price) || 0 })
     if (result) { toast.success('Customer added'); setShowForm(false) }
     else toast.error('Failed to add customer')
   }

  return (
    <div>
      <PageHeader title="Customers" action={<Btn small onClick={() => setShowForm(true)}>+ Add</Btn>} />
      <SearchBar value={search} onChange={setSearch} placeholder="Search customers..." />
      <FilterPills value={statusFilter} onChange={setStatusFilter}
        options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />

      {loading && <SkeletonList />}
      {!loading && filtered.length === 0 && <Empty icon="🏠" title="No Customers" sub="Add your first customer." cta="+ Add Customer" onCta={() => setShowForm(true)} />}
      {!loading && filtered.map(c => (
        <Card key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-base mb-1" style={{ color: '#0F2041' }}>{c.name}</div>
              <a href={`tel:${c.phone}`} className="text-sm text-gray-500 no-underline" onClick={e => e.stopPropagation()}>{c.phone}</a>
            </div>
            <div className="text-right">
              <Badge status={c.status} />
              <div className="font-bold text-lg mt-1.5" style={{ color: '#00C9A7' }}>${c.price}</div>
            </div>
          </div>
        </Card>
      ))}

      {showForm && <Modal title="New Customer" onClose={() => setShowForm(false)}>
        <CustomerForm onSave={handleCreate} onClose={() => setShowForm(false)} />
      </Modal>}
    </div>
  )
}
