import { PrismaClient } from '../../prisma';
import { IUserFiscalProfileRepository } from '@domain/repositories/IUserFiscalProfileRepository';
import { IFiscalProfileTransactionRunner } from '@application/use-cases/user/UpdateFiscalProfileUseCase';
import {
  UserFiscalProfile,
  UpsertFiscalProfileData,
  TaxDocumentType,
} from '@domain/entities/UserFiscalProfile';
import { LoggerFactory } from '@hbs/logging';

type PrismaFiscalProfile = {
  id: string;
  userId: string;
  documentType: string;
  documentNumber: string;
  legalName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaUserFiscalProfileRepository
  implements IUserFiscalProfileRepository, IFiscalProfileTransactionRunner
{
  private readonly logger = LoggerFactory.getInstance().createRepositoryLogger(
    'PrismaUserFiscalProfileRepository',
  );

  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserFiscalProfile | null> {
    const record = await this.prisma.userFiscalProfile.findUnique({
      where: { userId },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async findByDocument(
    documentType: TaxDocumentType,
    documentNumber: string,
  ): Promise<UserFiscalProfile | null> {
    const record = await this.prisma.userFiscalProfile.findFirst({
      where: { documentType, documentNumber },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async upsert(data: UpsertFiscalProfileData, tx?: unknown): Promise<UserFiscalProfile> {
    const client = (tx as PrismaClient) ?? this.prisma;
    const record = await client.userFiscalProfile.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        legalName: data.legalName ?? null,
      },
      update: {
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        legalName: data.legalName ?? null,
      },
    });
    return this.mapToEntity(record);
  }

  /**
   * Ejecuta la actualización del perfil fiscal en una transacción atómica:
   *   1. upsert UserFiscalProfile
   *   2. create AuditLog
   *   3. create SecurityEvent FISCAL_PROFILE_CHANGED
   */
  async runTransaction(
    userId: string,
    documentType: TaxDocumentType,
    documentNumber: string,
    legalName: string | null | undefined,
    oldValues: Record<string, unknown>,
  ): Promise<UserFiscalProfile> {
    const newValues: Record<string, unknown> = { documentType, legalName: legalName ?? null };

    const [fiscalProfile] = await this.prisma.$transaction([
      this.prisma.userFiscalProfile.upsert({
        where: { userId },
        create: {
          userId,
          documentType,
          documentNumber,
          legalName: legalName ?? null,
        },
        update: {
          documentType,
          documentNumber,
          legalName: legalName ?? null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: 'fiscal_profile_update',
          tableName: 'user_fiscal_profiles',
          recordId: userId,
          oldValues:
            Object.keys(oldValues).length > 0
              ? (oldValues as Parameters<typeof this.prisma.auditLog.create>[0]['data']['oldValues'])
              : undefined,
          newValues: {
            ...newValues,
            documentNumber, // valor real va a DB de auditoría (no al log de aplicación)
          } as Parameters<typeof this.prisma.auditLog.create>[0]['data']['newValues'],
        },
      }),
      this.prisma.securityEvent.create({
        data: {
          userId,
          eventType: 'FISCAL_PROFILE_CHANGED',
          description: `User updated fiscal profile (documentType: ${documentType})`,
          metadata: { documentType },
        },
      }),
    ]);

    this.logger.info('Fiscal profile transaction committed', { userId });
    return this.mapToEntity(fiscalProfile);
  }

  private mapToEntity(record: PrismaFiscalProfile): UserFiscalProfile {
    return {
      id: record.id,
      userId: record.userId,
      documentType: record.documentType as TaxDocumentType,
      documentNumber: record.documentNumber,
      legalName: record.legalName,
      verifiedAt: record.verifiedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
