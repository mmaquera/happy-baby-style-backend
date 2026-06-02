import type { TokenPayload } from '@hbs/auth';
import { SvgEntity, SvgEntityType } from '../entities/Svg';

export interface ISvgRepository {
  create(svg: SvgEntity, currentUser?: TokenPayload | null): Promise<SvgEntity>;
  findById(id: string): Promise<SvgEntity | null>;
  findByEntity(entityType: SvgEntityType, entityId: string): Promise<SvgEntity[]>;
  findByFileName(fileName: string): Promise<SvgEntity | null>;
  update(
    id: string,
    updates: Partial<SvgEntity>,
    currentUser?: TokenPayload | null,
  ): Promise<SvgEntity | null>;
  delete(id: string, currentUser?: TokenPayload | null): Promise<boolean>;
  findAll(limit?: number, offset?: number): Promise<SvgEntity[]>;
  count(): Promise<number>;
  findByEntityType(
    entityType: SvgEntityType,
    limit?: number,
    offset?: number,
  ): Promise<SvgEntity[]>;
}
