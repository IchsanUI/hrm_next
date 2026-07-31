import { z } from "zod"
import { requiredCoordinateSchema } from "@/lib/validations/geo"

export const lateArrivalRequestSchema = z.object({
  reason: z.string().min(1, "Alasan keterlambatan wajib diisi"),
  // Lokasi WAJIB — lihat components/location-required-field.tsx.
  locationLat: requiredCoordinateSchema(-90, 90),
  locationLng: requiredCoordinateSchema(-180, 180),
})

export const lateArrivalRejectionSchema = z.object({
  rejectionReason: z.string().min(1, "Alasan penolakan wajib diisi"),
})
