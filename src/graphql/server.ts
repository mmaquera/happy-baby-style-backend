import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express, { Express } from 'express';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { GraphQLError } from 'graphql';
import { DataLoaders } from '@infrastructure/loaders/DataLoaders';
import { AuthMiddleware } from '@presentation/middleware/AuthMiddleware';
import { AuthUser } from '@application/auth/AuthService';
import { DomainError } from '@domain/errors/DomainError';

export interface Context {
  user?: AuthUser | null;
  isAuthenticated: boolean;
  dataloaders: DataLoaders;
  req?: any;
}

export async function createApolloServer(app: Express): Promise<ApolloServer> {
  const authMiddleware = new AuthMiddleware();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (error, originalError) => {
      console.error('GraphQL Error:', error);
      
      // Only format domain errors, let others pass through
      if (originalError instanceof DomainError) {
        const domainError = originalError;
        return new GraphQLError(domainError.message, {
          extensions: {
            code: domainError.code,
            statusCode: domainError.statusCode,
            details: domainError.details,
          },
        });
      }
      
      // For internal server errors, only show them if they're real errors
      if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        // Check if this is a real error or just a cosmetic one
        if (error.message.includes('result.map is not a function') || 
            error.message.includes('Cannot read property')) {
          return new GraphQLError('Data processing error');
        }
        // Don't show generic internal server errors, return a clean error
        return new GraphQLError('An error occurred while processing your request');
      }
      
      return error;
    },
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  // Mount Express middlewares for /graphql
  app.use(
    '/graphql',
    // CORS is configured globally in index.ts
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }): Promise<Context> => {
        const authContext = await authMiddleware.createAuthContext(req);
        return {
          user: authContext.user,
          isAuthenticated: authContext.isAuthenticated,
          dataloaders: new DataLoaders(),
          req,
        };
      },
    })
  );

  return server;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down GraphQL server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down GraphQL server...');
  process.exit(0);
}); 