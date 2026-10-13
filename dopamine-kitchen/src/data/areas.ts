import type { Area } from './types'

// Approximate coordinates — used only to simulate distance, delivery time and fees.
export const AREAS: Area[] = [
  { id: 'banani', name: 'Banani', city: 'Dhaka', postcode: '1213', lat: 23.7937, lng: 90.4066, available: true },
  { id: 'gulshan-1', name: 'Gulshan 1', city: 'Dhaka', postcode: '1212', lat: 23.7808, lng: 90.4163, available: true },
  { id: 'gulshan-2', name: 'Gulshan 2', city: 'Dhaka', postcode: '1212', lat: 23.7948, lng: 90.4143, available: true },
  { id: 'baridhara', name: 'Baridhara', city: 'Dhaka', postcode: '1212', lat: 23.8007, lng: 90.4205, available: true },
  { id: 'dhanmondi', name: 'Dhanmondi', city: 'Dhaka', postcode: '1209', lat: 23.7461, lng: 90.3742, available: true },
  { id: 'uttara', name: 'Uttara', city: 'Dhaka', postcode: '1230', lat: 23.8759, lng: 90.3795, available: true },
  { id: 'mirpur', name: 'Mirpur', city: 'Dhaka', postcode: '1216', lat: 23.8223, lng: 90.3654, available: true },
  { id: 'mohammadpur', name: 'Mohammadpur', city: 'Dhaka', postcode: '1207', lat: 23.7662, lng: 90.3589, available: true },
  { id: 'bashundhara', name: 'Bashundhara R/A', city: 'Dhaka', postcode: '1229', lat: 23.8193, lng: 90.4526, available: true },
  { id: 'motijheel', name: 'Motijheel', city: 'Dhaka', postcode: '1000', lat: 23.733, lng: 90.4172, available: true },
  { id: 'mohakhali', name: 'Mohakhali', city: 'Dhaka', postcode: '1212', lat: 23.7778, lng: 90.405, available: true },
  { id: 'tejgaon', name: 'Tejgaon', city: 'Dhaka', postcode: '1208', lat: 23.7639, lng: 90.3925, available: true },
  { id: 'farmgate', name: 'Farmgate', city: 'Dhaka', postcode: '1215', lat: 23.7561, lng: 90.3872, available: true },
  { id: 'badda', name: 'Badda', city: 'Dhaka', postcode: '1212', lat: 23.7805, lng: 90.4267, available: true },
  { id: 'khilgaon', name: 'Khilgaon', city: 'Dhaka', postcode: '1219', lat: 23.7516, lng: 90.425, available: true },
  { id: 'malibagh', name: 'Malibagh', city: 'Dhaka', postcode: '1217', lat: 23.7483, lng: 90.4126, available: true },
  { id: 'lalbagh', name: 'Lalbagh (Old Dhaka)', city: 'Dhaka', postcode: '1211', lat: 23.7189, lng: 90.3882, available: true },
  { id: 'agrabad', name: 'Agrabad', city: 'Chattogram', postcode: '4100', lat: 22.3256, lng: 91.8123, available: false },
  { id: 'gec', name: 'GEC Circle', city: 'Chattogram', postcode: '4000', lat: 22.3589, lng: 91.8217, available: false },
  { id: 'zindabazar', name: 'Zindabazar', city: 'Sylhet', postcode: '3100', lat: 24.8968, lng: 91.8687, available: false },
]

export const areaById = (id: string) => AREAS.find((a) => a.id === id) ?? AREAS[0]

/** Road distance estimate in km (haversine × 1.35 detour factor). */
export function distanceKm(a: string, b: string): number {
  const A = areaById(a)
  const B = areaById(b)
  const R = 6371
  const dLat = ((B.lat - A.lat) * Math.PI) / 180
  const dLng = ((B.lng - A.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((A.lat * Math.PI) / 180) * Math.cos((B.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const d = 2 * R * Math.asin(Math.sqrt(h)) * 1.35
  return Math.max(0.6, Math.round(d * 10) / 10)
}
