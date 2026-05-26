import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

  scalar Upload

  enum ImageEntityType {
    product
    user
    category
  }

  enum SvgEntityType {
    product
    user
    category
    icon
    logo
  }

  type Image @key(fields: "id") {
    id: ID!
    fileName: String!
    originalName: String!
    mimeType: String!
    size: Int!
    url: String!
    bucket: String!
    path: String!
    entityType: String!
    entityId: String!
    createdAt: String!
  }

  type Svg @key(fields: "id") {
    id: ID!
    fileName: String!
    originalName: String!
    mimeType: String!
    size: Int!
    url: String!
    bucket: String!
    path: String!
    entityType: String!
    entityId: String!
    createdAt: String!
    dimensions: SvgDimensions
    viewBox: String
    optimized: Boolean!
  }

  type SvgDimensions {
    width: Float
    height: Float
  }

  type UploadImageData {
    url: String!
    filename: String!
    imageId: String!
  }

  type UploadImageResponse {
    success: Boolean!
    message: String
    code: String
    data: UploadImageData
  }

  type UploadSvgData {
    url: String!
    filename: String!
    svgId: String!
    dimensions: SvgDimensions
    viewBox: String
    optimized: Boolean
  }

  type UploadSvgResponse {
    success: Boolean!
    message: String
    code: String
    data: UploadSvgData
  }

  type Query {
    image(id: ID!): Image
    imagesByEntity(entityId: ID!, entityType: ImageEntityType!): [Image!]!
    svg(id: ID!): Svg
    svgsByEntity(entityType: SvgEntityType!, entityId: ID!): [Svg!]!
    svgs(limit: Int, offset: Int): [Svg!]!
    svgsCount: Int!
  }

  type Mutation {
    uploadImage(file: Upload!, entityType: String!, entityId: String!): UploadImageResponse!
    uploadSvg(
      file: Upload!
      entityType: String!
      entityId: String!
      optimize: Boolean
      sanitize: Boolean
    ): UploadSvgResponse!
    deleteImage(id: ID!): Boolean!
    deleteSvg(id: ID!): Boolean!
  }
`;
