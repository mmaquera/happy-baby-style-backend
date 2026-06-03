import { LoggerFactory } from '@hbs/logging';
import { DuplicateError } from '@domain/errors/DomainError';
import { IUserFiscalProfileRepository } from '@domain/repositories/IUserFiscalProfileRepository';
import {
  UserFiscalProfile,
  UserFiscalProfileEntity,
  TaxDocumentType,
} from '@domain/entities/UserFiscalProfile';

export interface UpdateFiscalProfileInput {
  userId: string;
  documentType: TaxDocumentType;
  documentNumber: string;
  legalName?: string | null;
}

export interface IFiscalProfileTransactionRunner {
  runTransaction(
    userId: string,
    documentType: TaxDocumentType,
    documentNumber: string,
    legalName: string | null | undefined,
    oldValues: Record<string, unknown>,
  ): Promise<UserFiscalProfile>;
}

/**
 * UpdateFiscalProfileUseCase
 *
 * Valida documento SUNAT, comprueba unicidad de RUC entre usuarios distintos,
 * lee el valor previo y ejecuta un $transaction con 3 operaciones:
 *   1. upsert UserFiscalProfile
 *   2. create AuditLog
 *   3. create SecurityEvent FISCAL_PROFILE_CHANGED
 *
 * El audit trail y SecurityEvent se escriben DENTRO de la transacción por el
 * transactionRunner (IFiscalProfileTransactionRunner). Este use-case no los
 * recibe como dependencias directas para no duplicar la responsabilidad.
 *
 * El número de documento se enmascara en los logs de aplicación (solo últimos 4 chars).
 * El valor completo va únicamente a audit_logs en DB.
 */
export class UpdateFiscalProfileUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'UpdateFiscalProfileUseCase',
  );

  constructor(
    private readonly fiscalProfileRepository: IUserFiscalProfileRepository,
    private readonly transactionRunner: IFiscalProfileTransactionRunner,
  ) {}

  async execute(input: UpdateFiscalProfileInput): Promise<UserFiscalProfile> {
    const { userId, documentType } = input;

    // 1. Normalización + validación (lanza ValidationError si falla)
    const documentNumber = UserFiscalProfileEntity.validateDocumentNumber(
      documentType,
      input.documentNumber,
    );
    // Hallazgo 6: normalizar legalName con trim antes de validar y persistir,
    // para que el valor almacenado sea el que usa SUNAT en el XML UBL 2.1.
    const legalName = input.legalName != null ? input.legalName.trim() : input.legalName;
    UserFiscalProfileEntity.validateLegalName(documentType, legalName);

    // Mascara para logs: solo últimos 4 caracteres
    const maskedDoc = documentNumber.slice(-4).padStart(documentNumber.length, '*');

    this.logger.info('Updating fiscal profile', {
      userId,
      documentType,
      documentNumberMasked: maskedDoc,
    });

    // 2. Guard de unicidad de RUC a nivel aplicación
    // NOTA TOCTOU (item A1 del backlog): el check findByDocument + upsert no es atómico.
    // La protección real contra duplicados de RUC es el partial-unique index definido en
    // la migración 0004. Bajo `prisma db push` ese índice no se aplica hasta que se
    // migre a `prisma migrate deploy` con baseline limpio (item A1 del roadmap de backlog).
    if (documentType === 'ruc') {
      const existing = await this.fiscalProfileRepository.findByDocument('ruc', documentNumber);
      if (existing && existing.userId !== userId) {
        throw new DuplicateError('UserFiscalProfile', 'documentNumber', documentNumber);
      }
    }

    // 3. Leer valor previo para audit (puede ser null si aún no existe)
    const previous = await this.fiscalProfileRepository.findByUserId(userId);
    const oldValues: Record<string, unknown> = previous
      ? {
          documentType: previous.documentType,
          documentNumber: previous.documentNumber, // valor real → va a DB de auditoría
          legalName: previous.legalName ?? null,
        }
      : {};

    // 4. Ejecutar transacción: upsert + auditLog + securityEvent
    const updated = await this.transactionRunner.runTransaction(
      userId,
      documentType,
      documentNumber,
      legalName ?? null,
      oldValues,
    );

    this.logger.info('Fiscal profile updated successfully', {
      userId,
      profileId: updated.id,
      documentType,
      documentNumberMasked: maskedDoc,
    });

    return updated;
  }
}
