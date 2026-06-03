import { UserFiscalProfile, UpsertFiscalProfileData, TaxDocumentType } from '../entities/UserFiscalProfile';

/**
 * Puerto de repositorio para UserFiscalProfile.
 * El parámetro `tx?` permite participar en un prisma.$transaction externo.
 */
export interface IUserFiscalProfileRepository {
  findByUserId(userId: string): Promise<UserFiscalProfile | null>;
  findByDocument(
    documentType: TaxDocumentType,
    documentNumber: string,
  ): Promise<UserFiscalProfile | null>;
  upsert(data: UpsertFiscalProfileData, tx?: unknown): Promise<UserFiscalProfile>;
}
