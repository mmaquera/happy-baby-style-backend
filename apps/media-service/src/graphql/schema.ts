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

  """
  Response for signedImageUrl query.
  signedUrl is valid for [ttl] seconds (clamped server-side to 60–3600 s).
  """
  type SignedUrlData {
    signedUrl: String!
    "Effective TTL in seconds (clamped to 60–3600 regardless of requested value)."
    ttl: Int!
    imageId: String!
  }

  type SignedUrlResponse {
    success: Boolean!
    message: String
    code: String
    data: SignedUrlData
  }

  type Query {
    image(id: ID!): Image
    imagesByEntity(entityId: ID!, entityType: ImageEntityType!, limit: Int, offset: Int): [Image!]!
    svg(id: ID!): Svg
    svgsByEntity(entityType: SvgEntityType!, entityId: ID!, limit: Int, offset: Int): [Svg!]!
    svgs(limit: Int, offset: Int): [Svg!]!
    svgsCount: Int!
    """
    Returns a presigned (or public) URL for downloading the image identified by [id].
    [ttl] is clamped server-side to [60, 3600] seconds (default 300 s).
    Currently public (bucket is public). Activate JWT guard when bucket turns private (Fase 4b).
    """
    signedImageUrl(id: ID!, ttl: Int): SignedUrlResponse!
  }

  type Mutation {
    "Upload a raster image. entityType must be one of the ImageEntityType enum values."
    uploadImage(file: Upload!, entityType: ImageEntityType!, entityId: String!): UploadImageResponse!
    "Upload an SVG. entityType must be one of the SvgEntityType enum values."
    uploadSvg(
      file: Upload!
      entityType: SvgEntityType!
      entityId: String!
      optimize: Boolean
    ): UploadSvgResponse!
    deleteImage(id: ID!): Boolean!
    deleteSvg(id: ID!): Boolean!
  }
`;
