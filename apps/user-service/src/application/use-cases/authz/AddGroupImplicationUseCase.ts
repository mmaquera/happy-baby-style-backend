import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../domain/repositories/IAuthzRepository';
import type { GroupImplicationEntity } from '../../../domain/entities/Authz';

export class AddGroupImplicationUseCase {
  private readonly logger: ILogger;

  constructor(private readonly repo: IAuthzRepository) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('AddGroupImplicationUseCase');
  }

  async execute(input: {
    groupId: string;
    impliedGroupId: string;
  }): Promise<GroupImplicationEntity> {
    if (input.groupId === input.impliedGroupId) {
      throw new ValidationError('Group cannot imply itself', 'impliedGroupId');
    }

    const [group, implied] = await Promise.all([
      this.repo.findGroupById(input.groupId),
      this.repo.findGroupById(input.impliedGroupId),
    ]);

    if (!group) {
      throw new NotFoundError('Group', input.groupId);
    }
    if (!implied) {
      throw new NotFoundError('Group', input.impliedGroupId);
    }

    // Idempotent: return existing if already present.
    const existing = await this.repo.findImplication(input.groupId, input.impliedGroupId);
    if (existing) {
      this.logger.info('Group implication already exists — idempotent', input);
      return existing;
    }

    // Cycle detection: BFS from impliedGroupId over the current graph.
    // If we can reach groupId from impliedGroupId, adding this edge would create a cycle.
    const allImplications = await this.repo.listGroupImplications();
    const adjacency = new Map<string, string[]>();
    for (const impl of allImplications) {
      if (!adjacency.has(impl.groupId)) adjacency.set(impl.groupId, []);
      adjacency.get(impl.groupId)!.push(impl.impliedGroupId);
    }

    const queue: string[] = [input.impliedGroupId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === input.groupId) {
        throw new BusinessLogicError(
          `Cannot add implication: would create a cycle (${input.groupId} → ... → ${input.groupId})`,
        );
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const next = adjacency.get(current) ?? [];
      queue.push(...next);
    }

    const implication = await this.repo.addGroupImplication(input.groupId, input.impliedGroupId);
    this.logger.info('Group implication added', {
      groupId: input.groupId,
      impliedGroupId: input.impliedGroupId,
      groupCode: group.code,
      impliedGroupCode: implied.code,
    });
    return implication;
  }
}
