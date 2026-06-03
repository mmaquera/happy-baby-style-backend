import { UserFiscalProfile } from '@domain/entities/UserFiscalProfile';

export interface FiscalProfileDTO {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  legalName: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toFiscalProfileDTO(entity: UserFiscalProfile): FiscalProfileDTO {
  return {
    id: entity.id,
    userId: entity.userId,
    documentType: entity.documentType,
    documentNumber: entity.documentNumber,
    legalName: entity.legalName ?? null,
    verifiedAt: entity.verifiedAt ? entity.verifiedAt.toISOString() : null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
