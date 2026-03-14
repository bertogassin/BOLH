import { api } from './api_client'

export type CompanyApplicationPayload = {
  companyName: string
  registrationNumber: string
  countryCode: string
  ownerFullName: string
  ownerRole: string
  contactEmail: string
  contactPhone: string
  website: string
}

export type CompanyApplicationResponse = {
  ok: boolean
  status: 'pending'
  application_id: string
  submitted_at: string
  normalized_email: string
  country_code: string
}

export async function submitCompanyApplication(payload: CompanyApplicationPayload): Promise<CompanyApplicationResponse> {
  return api<CompanyApplicationResponse>('/api/v1/company/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
