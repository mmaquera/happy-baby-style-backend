import crypto from 'crypto';

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  /** null means this is a root category (no parent). */
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CategoryEntity implements Category {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly slug: string,
    public readonly imageUrl: string | undefined,
    public readonly isActive: boolean,
    public readonly sortOrder: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    /** null or undefined means root category. */
    public readonly parentId: string | null | undefined = null,
  ) {}

  static create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): CategoryEntity {
    const now = new Date();
    return new CategoryEntity(
      crypto.randomUUID(),
      data.name,
      data.description,
      data.slug,
      data.imageUrl,
      data.isActive,
      data.sortOrder,
      now,
      now,
      data.parentId ?? null,
    );
  }

  update(data: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): CategoryEntity {
    return new CategoryEntity(
      this.id,
      data.name ?? this.name,
      data.description ?? this.description,
      data.slug ?? this.slug,
      data.imageUrl ?? this.imageUrl,
      data.isActive ?? this.isActive,
      data.sortOrder ?? this.sortOrder,
      this.createdAt,
      new Date(),
      'parentId' in data ? (data.parentId ?? null) : this.parentId,
    );
  }

  activate(): CategoryEntity {
    return this.update({ isActive: true });
  }

  deactivate(): CategoryEntity {
    return this.update({ isActive: false });
  }

  isValid(): boolean {
    return (
      this.name.length >= 2 &&
      this.name.length <= 100 &&
      this.slug.length >= 2 &&
      this.slug.length <= 100 &&
      this.sortOrder >= 0 &&
      this.sortOrder <= 999
    );
  }

  isRoot(): boolean {
    return this.parentId == null;
  }

  toJSON(): Category {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      slug: this.slug,
      imageUrl: this.imageUrl,
      isActive: this.isActive,
      sortOrder: this.sortOrder,
      parentId: this.parentId ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
