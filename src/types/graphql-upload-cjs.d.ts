/**
 * Type declarations for graphql-upload-cjs
 * This module provides CommonJS-compatible exports that are compatible with graphql-upload types
 */
declare module 'graphql-upload-cjs' {
  import { GraphQLUpload, GraphQLUploadExpressOptions } from 'graphql-upload';
  
  /**
   * Express middleware for handling GraphQL file uploads
   */
  export function graphqlUploadExpress(
    options?: GraphQLUploadExpressOptions
  ): (req: any, res: any, next: any) => void;
  
  /**
   * Koa middleware for handling GraphQL file uploads
   */
  export function graphqlUploadKoa(
    options?: GraphQLUploadExpressOptions
  ): any;
  
  /**
   * GraphQL Upload scalar type
   */
  export { GraphQLUpload, Upload };
  
  /**
   * Upload type (compatible with graphql-upload)
   */
  export interface Upload {
    filename: string;
    mimetype: string;
    encoding: string;
    createReadStream: () => NodeJS.ReadableStream;
  }
}

