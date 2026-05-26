import { SvgEntity, SvgEntityType } from '@domain/entities/Svg';

export interface ISvgRepository {
  create(svg: SvgEntity): Promise<SvgEntity>;
  findById(id: string): Promise<SvgEntity | null>;
  findByEntity(entityType: SvgEntityType, entityId: string): Promise<SvgEntity[]>;
  findByFileName(fileName: string): Promise<SvgEntity | null>;
  update(id: string, updates: Partial<SvgEntity>): Promise<SvgEntity | null>;
  delete(id: string): Promise<boolean>;
  findAll(limit?: number, offset?: number): Promise<SvgEntity[]>;
  count(): Promise<number>;
  findByEntityType(
    entityType: SvgEntityType,
    limit?: number,
    offset?: number,
  ): Promise<SvgEntity[]>;
}
