import { z } from 'zod';

export const vehicleLookupSchema = z.object({ plate: z.string().trim().min(1).max(10) });
