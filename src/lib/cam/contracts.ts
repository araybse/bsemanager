import { z } from 'zod'

export const camCadIngestSchema = z.object({
  projectId: z.number().int().positive(),
  projectNumber: z.string().min(1),
  sourceSystem: z.string().min(1),
  drawingKey: z.string().min(1),
  updatedAtSource: z.string().datetime(),
  objects: z.array(
    z.object({
      objectHandle: z.string().min(1),
      objectLayer: z.string().optional().nullable(),
      objectType: z.string().optional().nullable(),
      geometryType: z.string().optional().nullable(),
      geometry: z.record(z.string(), z.unknown()).optional().default({}),
      attributes: z.record(z.string(), z.unknown()).optional().default({}),
    })
  ),
})

export const cadPublishAckSchema = z.object({
  queueIds: z.array(z.number().int().positive()).min(1),
  status: z.enum(['acked', 'applied', 'failed']),
  errorMessage: z.string().optional(),
})

export const drainageCalculationSchema = z.object({
  projectId: z.number().int().positive(),
  basinCode: z.string().optional(),
  preCn: z.number().min(0).max(100),
  postCn: z.number().min(0).max(100),
  areaAcres: z.number().positive(),
  aerobicDepthIn: z.number().min(0),
  smpFactor: z.number().min(0),
})

export const utilitiesLetterSchema = z.object({
  projectId: z.number().int().positive(),
  letterType: z.enum(['pressure_connection', 'hydrant_flow']),
  issuerName: z.string().optional(),
  letterDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
})

export const utilitiesCalculationSchema = z.object({
  projectId: z.number().int().positive(),
  calcType: z.enum(['lift_station', 'fire_flow']),
  demandGpm: z.number().min(0),
  availablePressurePsi: z.number().min(0),
  minRequiredPressurePsi: z.number().min(0),
  totalDynamicHeadFt: z.number().min(0).optional(),
})

export const crossingDetectionSchema = z.object({
  projectId: z.number().int().positive(),
  sourceSystem: z.string().min(1),
  updatedAtSource: z.string().datetime(),
  crossings: z.array(
    z.object({
      crossingCode: z.string().min(1),
      sourceNetworkA: z.string().min(1),
      sourceNetworkB: z.string().min(1),
      sourceRefA: z.string().min(1),
      sourceRefB: z.string().min(1),
      xCoord: z.number(),
      yCoord: z.number(),
    })
  ),
})

export const crossingResolveSchema = z.object({
  crossingId: z.number().int().positive(),
  finishGradeElev: z.number(),
  gravityUpstreamInvert: z.number(),
  gravityDownstreamInvert: z.number(),
  distanceFromUpstreamFt: z.number().min(0),
  totalRunFt: z.number().positive(),
  gravityDiameterIn: z.number().positive(),
  pressureTopElev: z.number(),
  requiredClearanceFt: z.number().positive(),
  editedBy: z.string().optional(),
})
