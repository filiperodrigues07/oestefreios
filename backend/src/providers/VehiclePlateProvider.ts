export interface VehicleLookupResult {
  plate: string;
  brand?: string;
  model?: string;
  version?: string;
  manufactureYear?: number;
  modelYear?: number;
  color?: string;
  fuel?: string;
  city?: string;
  state?: string;
  engine?: string;
  fipeCode?: string;
}

export type ProviderLookupResult =
  | { kind: 'found'; vehicle: VehicleLookupResult }
  | { kind: 'not_found' };

export interface VehiclePlateProvider {
  readonly name: string;
  lookup(plate: string): Promise<ProviderLookupResult>;
}
