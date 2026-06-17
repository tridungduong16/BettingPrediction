import { localeForLanguage, type LanguageCode } from '@/i18n/languages'

const flagAssetBasePath = '/country-flags-main/svg'

export interface TeamIdentity {
  countryCode: string
  displayName: string
  flagUrl: string
  shortName: string
  sourceName: string
}

const teamCountryCodes: Record<string, string> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia & Herzegovina': 'ba',
  'Bosnia and Herzegovina': 'ba',
  Brazil: 'br',
  Canada: 'ca',
  'Cape Verde': 'cv',
  Chile: 'cl',
  Colombia: 'co',
  'Congo DR': 'cd',
  Croatia: 'hr',
  Curaçao: 'cw',
  Curacao: 'cw',
  'Czech Republic': 'cz',
  Czechia: 'cz',
  Denmark: 'dk',
  'DR Congo': 'cd',
  Ecuador: 'ec',
  Egypt: 'eg',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Haiti: 'ht',
  Iran: 'ir',
  Iraq: 'iq',
  Italy: 'it',
  'Ivory Coast': 'ci',
  Japan: 'jp',
  Jordan: 'jo',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Poland: 'pl',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  Serbia: 'rs',
  Spain: 'es',
  'South Africa': 'za',
  'South Korea': 'kr',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  Turkey: 'tr',
  Türkiye: 'tr',
  Uruguay: 'uy',
  USA: 'us',
  'United States': 'us',
  Uzbekistan: 'uz',
  Wales: 'gb-wls',
}

const teamDisplayNamesVi: Record<string, string> = {
  Algeria: 'Algeria',
  Argentina: 'Argentina',
  Australia: 'Úc',
  Austria: 'Áo',
  Belgium: 'Bỉ',
  'Bosnia & Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  Brazil: 'Brazil',
  Canada: 'Canada',
  'Cape Verde': 'Cape Verde',
  Chile: 'Chile',
  Colombia: 'Colombia',
  Croatia: 'Croatia',
  Curaçao: 'Curaçao',
  Curacao: 'Curaçao',
  'Czech Republic': 'CH Séc',
  Czechia: 'CH Séc',
  Denmark: 'Đan Mạch',
  Draw: 'Hòa',
  'DR Congo': 'DR Congo',
  Ecuador: 'Ecuador',
  Egypt: 'Ai Cập',
  England: 'Anh',
  France: 'Pháp',
  Germany: 'Đức',
  Ghana: 'Ghana',
  Haiti: 'Haiti',
  Iran: 'Iran',
  Iraq: 'Iraq',
  Italy: 'Ý',
  'Ivory Coast': 'Bờ Biển Ngà',
  Japan: 'Nhật Bản',
  Jordan: 'Jordan',
  Mexico: 'Mexico',
  Morocco: 'Morocco',
  Netherlands: 'Hà Lan',
  'New Zealand': 'New Zealand',
  Norway: 'Na Uy',
  Panama: 'Panama',
  Paraguay: 'Paraguay',
  Poland: 'Ba Lan',
  Portugal: 'Bồ Đào Nha',
  Qatar: 'Qatar',
  'Saudi Arabia': 'Ả Rập Xê Út',
  Scotland: 'Scotland',
  Senegal: 'Senegal',
  Serbia: 'Serbia',
  Spain: 'Tây Ban Nha',
  'South Africa': 'Nam Phi',
  'South Korea': 'Hàn Quốc',
  Sweden: 'Thụy Điển',
  Switzerland: 'Thụy Sĩ',
  Tunisia: 'Tunisia',
  Turkey: 'Thổ Nhĩ Kỳ',
  Türkiye: 'Thổ Nhĩ Kỳ',
  Uruguay: 'Uruguay',
  USA: 'Mỹ',
  'United States': 'Mỹ',
  Uzbekistan: 'Uzbekistan',
  Wales: 'Wales',
}

function normalizeTeamName(name: string) {
  return name.trim().toLocaleLowerCase(localeForLanguage('en'))
}

export function getTeamCountryCode(name?: string | null) {
  if (!name) {
    return undefined
  }

  const directMatch = teamCountryCodes[name]
  if (directMatch) {
    return directMatch
  }

  const normalizedName = normalizeTeamName(name)
  const matchedTeam = Object.keys(teamCountryCodes).find((teamName) => normalizeTeamName(teamName) === normalizedName)
  return matchedTeam ? teamCountryCodes[matchedTeam] : undefined
}

export function shortName(name: string) {
  const words = name.replace(/&/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase()
  }

  return words.map((word) => word[0]).join('').slice(0, 3).toUpperCase()
}

export function displayTeamName(name?: string | null, language: LanguageCode = 'vi') {
  if (!name) {
    return ''
  }

  if (language === 'en') {
    return name === 'Draw' ? 'Draw' : name
  }

  return teamDisplayNamesVi[name] ?? name
}

export function fallbackFlag(name: string) {
  const initials = shortName(name || 'TBD').slice(0, 3)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="18" fill="#eef4ff"/><text x="80" y="70" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="800" fill="#12245a">${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function getTeamIdentity(name: string, language: LanguageCode = 'vi'): TeamIdentity {
  const sourceName = name.trim()
  const countryCode = getTeamCountryCode(sourceName)
  const fallbackCode = shortName(sourceName || 'TBD')

  return {
    countryCode: countryCode?.toUpperCase() ?? fallbackCode,
    displayName: displayTeamName(sourceName, language) || sourceName,
    flagUrl: countryCode ? `${flagAssetBasePath}/${countryCode}.svg` : fallbackFlag(sourceName),
    shortName: fallbackCode,
    sourceName,
  }
}
