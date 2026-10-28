/** Raw geocoder payload as returned by the backend or Nominatim. */
export interface NominatimRawResult {
  display_name?: string
  address_type?: string
  lat?: string | number
  lon?: string | number
  lng?: string | number
  place_id?: string | number
  osm_id?: string | number
  address?: Partial<NominatimAddress>
}

/** The address fields the app uses. */
export interface NominatimAddress {
  house_number: string | undefined
  road: string | undefined
  village: string | undefined
  hamlet: string | undefined
  suburb: string | undefined
  town: string | undefined
  city: string | undefined
  county: string | undefined
  state: string | undefined
  region: string | undefined
  country: string | undefined
}

/** A parsed geocoder result with numeric coordinates. */
export interface NominatimResult {
  display_name: string | undefined
  address_type: string | undefined
  lat: number
  lng: number
  place_id: string | number | undefined
  osm_id: string | number | undefined
  address: NominatimAddress
}

/** Parses a raw geocoder payload; `lng` falls back to `lon` when falsy, a missing address is tolerated. */
export function parseNominatimResult(data: NominatimRawResult): NominatimResult {
  const a = data.address ?? {}
  return {
    display_name: data.display_name,
    address_type: data.address_type,
    lat: Number(data.lat),
    lng: Number(data.lng || data.lon),
    place_id: data.place_id,
    osm_id: data.osm_id,
    address: {
      house_number: a.house_number,
      road: a.road,
      village: a.village,
      hamlet: a.hamlet,
      suburb: a.suburb,
      town: a.town,
      city: a.city,
      county: a.county,
      state: a.state,
      region: a.region,
      country: a.country,
    },
  }
}
