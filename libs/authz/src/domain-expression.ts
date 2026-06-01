import { z } from 'zod';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Zod schema — DomainExpr
// ---------------------------------------------------------------------------

/** Variables de contexto: $ctx.<path> */
const CtxRefSchema = z.object({
  $ctx: z
    .string()
    .regex(
      /^[a-z_][a-z0-9_.]*$/i,
      'Invalid $ctx path — must be dotted identifier like "current_user.id"',
    ),
});

const LiteralSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const ValueSchema = z.union([LiteralSchema, CtxRefSchema]);

/** Operators de comparación permitidos (whitelist explícita). */
const ComparisonOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in']);
type ComparisonOp = z.infer<typeof ComparisonOpSchema>;

const ComparisonExprSchema = z.object({
  op: ComparisonOpSchema,
  /** Dotted path al campo del modelo (e.g. "userId", "order.status"). */
  field: z
    .string()
    .regex(
      /^[a-z_][a-zA-Z0-9_.]*$/,
      'Invalid field path — must be camelCase or dotted like "order.userId"',
    ),
  value: ValueSchema,
});

// Tipos recursivos: TypeScript necesita la declaración explícita antes del z.lazy.
type ComparisonExpr = z.infer<typeof ComparisonExprSchema>;
type LogicalAndExpr = { op: 'and'; args: DomainExpr[] };
type LogicalOrExpr = { op: 'or'; args: DomainExpr[] };
type LogicalNotExpr = { op: 'not'; arg: DomainExpr };
type DomainExpr = ComparisonExpr | LogicalAndExpr | LogicalOrExpr | LogicalNotExpr;

const DomainExprSchema: z.ZodType<DomainExpr> = z.lazy(() =>
  z.union([
    ComparisonExprSchema,
    z.object({ op: z.literal('and'), args: z.array(DomainExprSchema).min(1) }),
    z.object({ op: z.literal('or'), args: z.array(DomainExprSchema).min(1) }),
    z.object({ op: z.literal('not'), arg: DomainExprSchema }),
  ]),
);

export { DomainExprSchema, type DomainExpr, type ComparisonOp };

// ---------------------------------------------------------------------------
// Evaluación context
// ---------------------------------------------------------------------------

export interface EvaluationContext {
  currentUser: TokenPayload | null;
  // Espacio para extensiones futuras (tenant_id, request_metadata, etc.)
}

// ---------------------------------------------------------------------------
// Compilador: DomainExpr → Prisma WhereInput shape
// ---------------------------------------------------------------------------

/**
 * Convierte una DomainExpr (JSON arbitrario) en un objeto compatible con
 * Prisma `where`. Valida el shape vía Zod antes de compilar.
 *
 * Lanza `ZodError` si la expresión no es válida.
 * Lanza `Error` si una referencia `$ctx` no se puede resolver.
 *
 * NOTA: el output está acoplado al shape de Prisma WhereInput by design
 * (decisión Fase 5 — las rules se aplican en repositorios). Si en el futuro
 * se necesita evaluar contra objetos in-memory, extraer un AST intermedio.
 */
export function compileDomainExpr(
  expr: unknown,
  context: EvaluationContext,
): Record<string, unknown> {
  const validated = DomainExprSchema.parse(expr); // throws ZodError on invalid shape
  return compile(validated, context);
}

function compile(expr: DomainExpr, ctx: EvaluationContext): Record<string, unknown> {
  // Logical: and/or have `args`
  if ('args' in expr) {
    const compiled = expr.args.map(arg => compile(arg, ctx));
    if (expr.op === 'and') return { AND: compiled };
    return { OR: compiled };
  }

  // Logical: not has `arg`
  if ('arg' in expr) {
    return { NOT: compile(expr.arg, ctx) };
  }

  // Comparison
  const { op, field, value } = expr;
  const resolvedValue = resolveValue(value, ctx);
  const prismaOp = mapOperator(op);
  return setNestedField(field, { [prismaOp]: resolvedValue });
}

function resolveValue(value: unknown, ctx: EvaluationContext): unknown {
  if (typeof value === 'object' && value !== null && '$ctx' in value) {
    return resolveCtxPath((value as { $ctx: string }).$ctx, ctx);
  }
  return value;
}

/**
 * Resuelve un path `$ctx.*` contra el EvaluationContext.
 * Por seguridad, solo se aceptan paths que empiezan con `current_user.`.
 * Campos adicionales de contexto (tenant_id, etc.) se añadirán aquí en fases futuras.
 */
function resolveCtxPath(path: string, ctx: EvaluationContext): unknown {
  if (!path.startsWith('current_user.')) {
    throw new Error(
      `Unsupported $ctx path: "${path}". Only "current_user.*" paths are allowed.`,
    );
  }

  const field = path.substring('current_user.'.length);

  // Whitelist explícita de campos permitidos para evitar exposición accidental de claims.
  const allowedFields: Record<string, (u: TokenPayload | null) => unknown> = {
    id: u => u?.userId,
    userId: u => u?.userId,
    email: u => u?.email,
    role: u => u?.role,
    groups: u => (u as any)?.groups ?? [],
    permissions: u => u?.permissions ?? [],
  };

  const getter = allowedFields[field];
  if (!getter) {
    throw new Error(
      `Unknown current_user field: "${field}". Allowed: ${Object.keys(allowedFields).join(', ')}.`,
    );
  }

  return getter(ctx.currentUser);
}

function mapOperator(op: ComparisonOp): string {
  const opMap: Record<ComparisonOp, string> = {
    eq: 'equals',
    neq: 'not',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    in: 'in',
    not_in: 'notIn',
  };
  return opMap[op];
}

/**
 * Convierte un field dotted-path en un objeto Prisma anidado.
 * 'order.userId' → { order: { userId: <op> } }
 */
function setNestedField(
  field: string,
  op: Record<string, unknown>,
): Record<string, unknown> {
  const dotIndex = field.indexOf('.');
  if (dotIndex === -1) return { [field]: op };
  const head = field.substring(0, dotIndex);
  const tail = field.substring(dotIndex + 1);
  return { [head]: setNestedField(tail, op) };
}
