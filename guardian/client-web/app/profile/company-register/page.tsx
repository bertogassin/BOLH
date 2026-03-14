'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Building2, ShieldCheck, Search, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { BOLHNav } from '@/components/BOLHNav'
import { includesNameHint, luhnCheck, normalize, onlyDigits } from '@/lib/company/registerUtils'
import { submitCompanyApplication } from '@/lib/api_company'

type CompanyCheckResult = {
  checked: boolean
  exists: boolean
  source: string
  companyName?: string
  registration?: string
  ownerLikelyMatch?: boolean
  ownerEvidence?: string
  note?: string
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'mail.ru',
  'yandex.ru',
  'proton.me',
  'protonmail.com',
])

export default function CompanyRegisterPage() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [companyName, setCompanyName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [countryCode, setCountryCode] = useState('FR')
  const [ownerFullName, setOwnerFullName] = useState('')
  const [ownerRole, setOwnerRole] = useState('Owner')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkResult, setCheckResult] = useState<CompanyCheckResult | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const formatSubmitError = (rawMessage: string) => {
    const msg = rawMessage.trim()
    const lower = msg.toLowerCase()
    if (!msg) return t('company_register.save_failed')

    if (lower.includes('auth required')) return t('company_register.login_required')
    if (lower.includes('forbidden')) return t('company_register.error_account_type_forbidden')

    if (lower.includes('invalid company name')) return t('company_register.error_invalid_company_name')
    if (lower.includes('invalid country code')) return t('company_register.error_invalid_country')
    if (lower.includes('invalid owner full name')) return t('company_register.error_invalid_owner_name')
    if (lower.includes('invalid owner role')) return t('company_register.error_invalid_owner_role')
    if (lower.includes('invalid company email')) return t('company_register.error_invalid_company_email')
    if (lower.includes('corporate email required')) return t('company_register.error_corporate_email_required')
    if (lower.includes('invalid business phone')) return t('company_register.error_invalid_business_phone')
    if (lower.includes('invalid company website')) return t('company_register.error_invalid_website')
    if (lower.includes('invalid registration number')) {
      return countryCode === 'FR' ? t('company_register.error_siren_format') : t('company_register.error_reg_too_short')
    }

    if (lower.includes('signed request required') || lower.includes('invalid request signature') || lower.includes('expired signature')) {
      return t('company_register.error_security_check_failed')
    }
    if (lower.includes('too many requests')) return t('company_register.error_too_many_attempts')
    if (lower.includes('server unavailable') || lower.includes('temporarily unavailable')) {
      return t('company_register.error_server_temporarily_unavailable')
    }

    return msg
  }

  const runAutomaticCheck = async () => {
    setError('')
    setSuccess('')
    const company = normalize(companyName)
    const owner = normalize(ownerFullName)
    const regRaw = normalize(registrationNumber)
    const email = normalize(contactEmail).toLowerCase()
    const phoneDigits = onlyDigits(contactPhone)
    const websiteValue = normalize(website)
    if (!company || !owner || !regRaw) {
      setError(t('company_register.error_fill_required'))
      return
    }
    const strictEmailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
    if (!strictEmailRegex.test(email)) {
      setError(t('company_register.error_invalid_company_email'))
      return
    }
    const domain = email.split('@')[1] || ''
    if (FREE_EMAIL_DOMAINS.has(domain)) {
      setError(t('company_register.error_corporate_email_required'))
      return
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError(t('company_register.error_invalid_business_phone'))
      return
    }
    if (websiteValue) {
      try {
        const u = new URL(websiteValue.startsWith('http') ? websiteValue : `https://${websiteValue}`)
        if (!u.hostname.includes('.')) throw new Error('invalid_host')
      } catch {
        setError(t('company_register.error_invalid_website'))
        return
      }
    }

    setChecking(true)
    try {
      // 1) Local structural validation by country
      let localValid = true
      let localNote = ''
      const digits = onlyDigits(regRaw)
      if (countryCode === 'FR') {
        // SIREN(9) or SIRET(14) => Luhn checksum
        if (!(digits.length === 9 || digits.length === 14) || !luhnCheck(digits)) {
          localValid = false
          localNote = t('company_register.error_siren_format')
        }
      } else if (digits.length < 6) {
        localValid = false
        localNote = t('company_register.error_reg_too_short')
      }

      if (!localValid) {
        setCheckResult({
          checked: true,
          exists: false,
          source: 'local_rules',
          ownerLikelyMatch: false,
          note: localNote,
        })
        return
      }

      // 2) Remote existence check
      if (countryCode === 'FR') {
        const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(digits)}&page=1&per_page=1`
        const res = await fetch(url)
        const data = await res.json().catch(() => ({}))
        const first = Array.isArray((data as { results?: unknown[] }).results) ? (data as { results: unknown[] }).results[0] : null
        if (!first || typeof first !== 'object') {
          setCheckResult({
            checked: true,
            exists: false,
            source: 'api.gouv.fr',
            ownerLikelyMatch: false,
            note: t('company_register.not_found_registry'),
          })
          return
        }
        const candidateName =
          String((first as Record<string, unknown>).nom_complet || (first as Record<string, unknown>).nom_raison_sociale || company)
        const reg =
          String((first as Record<string, unknown>).siret || (first as Record<string, unknown>).siren || digits)
        const ownerMatch = includesNameHint(owner, first)
        setCheckResult({
          checked: true,
          exists: true,
          source: 'api.gouv.fr',
          companyName: candidateName,
          registration: reg,
          ownerLikelyMatch: ownerMatch.match,
          ownerEvidence: ownerMatch.evidence,
          note: ownerMatch.match
            ? t('company_register.found_owner_partial')
            : t('company_register.found_owner_not_confirmed'),
        })
        return
      }

      // fallback for non-FR: OpenCorporates
      const ocUrl = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(regRaw)}`
      const ocRes = await fetch(ocUrl)
      const ocData = await ocRes.json().catch(() => ({}))
      const companies =
        (ocData as { results?: { companies?: Array<{ company?: Record<string, unknown> }> } }).results?.companies || []
      const found = companies[0]?.company
      if (!found) {
        setCheckResult({
          checked: true,
          exists: false,
          source: 'OpenCorporates',
          ownerLikelyMatch: false,
          note: t('company_register.not_found_registry'),
        })
        return
      }
      const ownerMatch = includesNameHint(owner, found)
      setCheckResult({
        checked: true,
        exists: true,
        source: 'OpenCorporates',
        companyName: String(found.name || company),
        registration: String(found.company_number || regRaw),
        ownerLikelyMatch: ownerMatch.match,
        ownerEvidence: ownerMatch.evidence,
        note: ownerMatch.match
          ? t('company_register.found_owner_match')
          : t('company_register.found_owner_not_confirmed'),
      })
    } catch (e) {
      setCheckResult({
        checked: true,
        exists: false,
        source: 'network',
        ownerLikelyMatch: false,
        note: e instanceof Error ? e.message : t('company_register.autocheck_unavailable'),
      })
    } finally {
      setChecking(false)
    }
  }

  const submitApplication = async () => {
    setError('')
    setSuccess('')
    if (!user) {
      setError(t('company_register.login_required'))
      return
    }
    if (!checkResult?.checked) {
      setError(t('company_register.run_check_first'))
      return
    }
    if (!checkResult.exists) {
      setError(t('company_register.company_not_verified'))
      return
    }
    const email = normalize(contactEmail).toLowerCase()
    const strictEmailRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
    if (!strictEmailRegex.test(email)) {
      setError(t('company_register.error_invalid_company_email'))
      return
    }
    const domain = email.split('@')[1] || ''
    if (FREE_EMAIL_DOMAINS.has(domain)) {
      setError(t('company_register.error_corporate_email_required'))
      return
    }
    const phoneDigits = onlyDigits(contactPhone)
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError(t('company_register.error_invalid_business_phone'))
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        companyName: normalize(companyName),
        registrationNumber: normalize(registrationNumber),
        countryCode,
        ownerFullName: normalize(ownerFullName),
        ownerRole: normalize(ownerRole) || 'Owner',
        contactEmail: email,
        contactPhone: normalize(contactPhone),
        website: normalize(website),
      }
      await submitCompanyApplication({
        companyName: payload.companyName,
        registrationNumber: payload.registrationNumber,
        countryCode: payload.countryCode,
        ownerFullName: payload.ownerFullName,
        ownerRole: payload.ownerRole,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        website: payload.website,
      })
      setSuccess(t('company_register.submitted_pending'))
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      setError(formatSubmitError(raw))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1b26] text-white flex items-center justify-center">
        <Link href="/login" className="text-violet-400 hover:underline">{t('auth.login_btn')}</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] text-white pb-24">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1b26]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{t('company_register.title')}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 space-y-4">
        <div className="rounded-2xl bg-white/10 border border-violet-400 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-300" />
            <p className="text-sm text-white/80">{t('company_register.hint_fill_and_check')}</p>
          </div>

          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t('company_register.company_name')}
            className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
            >
              <option value="FR">FR</option>
              <option value="DE">DE</option>
              <option value="ES">ES</option>
              <option value="IT">IT</option>
              <option value="TR">TR</option>
              <option value="GB">GB</option>
              <option value="US">US</option>
            </select>
            <input
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder={t('company_register.registration_number')}
              className="col-span-2 rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
            />
          </div>
          <input
            value={ownerFullName}
            onChange={(e) => setOwnerFullName(e.target.value)}
            placeholder={t('company_register.owner_full_name')}
            className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
          />
          <input
            value={ownerRole}
            onChange={(e) => setOwnerRole(e.target.value)}
            placeholder={t('company_register.owner_role')}
            className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t('company_register.company_email')}
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
            />
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t('company_register.phone')}
              className="rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
            />
          </div>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t('company_register.website_optional')}
            className="w-full rounded-xl bg-white/10 border border-violet-400 px-3 py-3 min-h-[44px] outline-none"
          />

          <button
            type="button"
            onClick={runAutomaticCheck}
            disabled={checking}
            className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-violet-400 py-3 min-h-[44px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {checking ? t('company_register.checking') : t('company_register.autocheck')}
          </button>

          {checkResult?.checked && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                checkResult.exists
                  ? 'bg-green-500/20 border-green-500/40 text-green-100'
                  : 'bg-red-500/20 border-red-500/40 text-red-100'
              }`}
            >
              <div className="font-semibold flex items-center gap-2">
                {checkResult.exists ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {checkResult.exists ? t('company_register.company_found') : t('company_register.company_not_confirmed')}
              </div>
              <p className="mt-1 text-xs opacity-90">{t('company_register.source')}: {checkResult.source}</p>
              {checkResult.companyName && <p className="mt-1 text-xs">{t('company_register.company_name_label')}: {checkResult.companyName}</p>}
              {checkResult.registration && <p className="mt-1 text-xs">{t('company_register.registration_label')}: {checkResult.registration}</p>}
              {checkResult.note && <p className="mt-1 text-xs">{checkResult.note}</p>}
              {checkResult.ownerEvidence && <p className="mt-1 text-xs">{t('company_register.owner_check')}: {checkResult.ownerEvidence}</p>}
            </div>
          )}

          <button
            type="button"
            onClick={submitApplication}
            disabled={submitting || !checkResult?.exists}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-400 py-3 min-h-[44px] font-semibold disabled:opacity-50"
          >
            {submitting ? t('company_register.sending') : t('company_register.become_partner')}
          </button>
          <p className="text-xs text-white/60">
            {t('company_register.footer_note_before')} <span className="text-white">{t('company_register.pending')}</span>. {t('company_register.footer_note_after')}
          </p>
        </div>
        {success && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/20 p-3 text-sm text-green-200 inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {success}
          </div>
        )}
        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/20 p-3 text-sm text-red-200">{error}</div>}
      </main>
      <BOLHNav current="profile" />
    </div>
  )
}
