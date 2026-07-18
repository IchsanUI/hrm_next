const EARTH_RADIUS_METERS = 6371000

// Jarak antara dua koordinat, dalam meter (formula haversine).
export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

export type GeoLocationCandidate = {
  name: string
  latitude: number | null
  longitude: number | null
  geofenceRadius: number
}

// Cari lokasi kantor terdekat dari sebuah koordinat, lalu bentuk label
// informatif: nama lokasi saja kalau di dalam radius geofence-nya, atau
// "<jarak>m dari <nama lokasi>" kalau di luar radius.
export function resolveNearestLocationLabel(
  lat: number,
  lng: number,
  candidates: GeoLocationCandidate[]
): { label: string; distanceMeters: number } | null {
  let nearest: { name: string; distance: number; radius: number } | null = null

  for (const candidate of candidates) {
    if (candidate.latitude === null || candidate.longitude === null) continue
    const distance = distanceInMeters(lat, lng, candidate.latitude, candidate.longitude)
    if (!nearest || distance < nearest.distance) {
      nearest = { name: candidate.name, distance, radius: candidate.geofenceRadius }
    }
  }

  if (!nearest) return null

  const label =
    nearest.distance <= nearest.radius
      ? nearest.name
      : `${formatDistance(nearest.distance)} dari ${nearest.name}`

  return { label, distanceMeters: nearest.distance }
}

// >=1km ditampilkan dalam km (1 desimal) biar tidak ada angka meter yang
// panjang, di bawah itu tetap meter bulat.
function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`
  }
  return `${Math.round(meters)}m`
}
