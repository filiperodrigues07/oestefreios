import type { Request, Response } from 'express';
import { getVehicleLookupQuota, lookupVehiclePlate } from '../services/vehicleLookup.service.js';
import { success } from '../utils/apiResponse.js';

export async function getVehicleLookupQuotaHandler(_req: Request, res: Response) {
  success(res, await getVehicleLookupQuota());
}

export async function lookupVehiclePlateHandler(req: Request, res: Response) {
  success(res, await lookupVehiclePlate(req.body.plate));
}
