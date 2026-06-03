import { ValidationError } from '../errors/DomainError';

export type TaxDocumentType = 'ruc' | 'dni' | 'ce';

export interface UserFiscalProfile {
  id: string;
  userId: string;
  documentType: TaxDocumentType;
  documentNumber: string;
  legalName?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertFiscalProfileData {
  userId: string;
  documentType: TaxDocumentType;
  documentNumber: string;
  legalName?: string | null;
}

/**
 * Entidad de dominio para el perfil fiscal SUNAT del usuario.
 * Contiene validaciones de documentos tributarios peruanos:
 *   - DNI: 8 dígitos
 *   - CE:  9–12 caracteres alfanuméricos
 *   - RUC: 11 dígitos con verificación módulo 11
 *
 * `legalName` es obligatorio si documentType === 'ruc'.
 */
export class UserFiscalProfileEntity {
  /**
   * Normaliza y valida número + tipo de documento.
   * Lanza ValidationError en caso de formato incorrecto.
   * Retorna el número normalizado.
   */
  static validateDocumentNumber(type: TaxDocumentType, rawNumber: string): string {
    let number = rawNumber.trim();

    if (type === 'ruc' || type === 'dni') {
      // Eliminar espacios y guiones, dejar solo dígitos
      number = number.replace(/[\s\-]/g, '').replace(/[^\d]/g, '');
    } else if (type === 'ce') {
      // Mayúsculas
      number = number.toUpperCase();
    }

    switch (type) {
      case 'dni': {
        if (!/^\d{8}$/.test(number)) {
          throw new ValidationError('DNI debe contener exactamente 8 dígitos', 'documentNumber');
        }
        return number;
      }
      case 'ce': {
        if (!/^[A-Z0-9]{9,12}$/.test(number)) {
          throw new ValidationError(
            'CE debe contener entre 9 y 12 caracteres alfanuméricos',
            'documentNumber',
          );
        }
        return number;
      }
      case 'ruc': {
        if (!/^\d{11}$/.test(number)) {
          throw new ValidationError('RUC debe contener exactamente 11 dígitos', 'documentNumber');
        }
        // Módulo 11: pesos [5,4,3,2,7,6,5,4,3,2] sobre los primeros 10 dígitos
        const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        const digits = number.split('').map(Number);
        const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
        const residuo = sum % 11;
        let expected = 11 - residuo;
        if (expected === 10) expected = 0;
        if (expected === 11) expected = 1;
        if (digits[10] !== expected) {
          throw new ValidationError('RUC inválido: dígito verificador incorrecto', 'documentNumber');
        }
        return number;
      }
      default: {
        throw new ValidationError('Tipo de documento no soportado', 'documentType');
      }
    }
  }

  /**
   * Valida legalName:
   *  - Requerido si documentType === 'ruc'
   *  - Máx 200 caracteres
   *  - Sin caracteres de control ni `<>`
   */
  static validateLegalName(documentType: TaxDocumentType, legalName?: string | null): void {
    if (documentType === 'ruc') {
      if (!legalName || legalName.trim().length === 0) {
        throw new ValidationError('legalName es obligatorio para RUC', 'legalName');
      }
    }

    if (legalName) {
      if (legalName.length > 200) {
        throw new ValidationError('legalName no puede superar 200 caracteres', 'legalName');
      }
      // Sin caracteres de control (0x00–0x1F, 0x7F) ni < >
      if (/[\x00-\x1F\x7F<>]/.test(legalName)) {
        throw new ValidationError(
          'legalName contiene caracteres no permitidos',
          'legalName',
        );
      }
    }
  }
}
