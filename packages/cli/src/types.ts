export type FieldType = "text" | "url" | "number" | "boolean" | "date";

export type CollectionField = {
  key: string;
  label: string;
  type: FieldType;
};

export type SyncedCollection = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  schema: CollectionField[];
};

export type PullResponse = {
  workspaceId: string;
  pulledAt: string;
  collections: SyncedCollection[];
};

export type PushResponse = {
  workspaceId: string;
  updatedAt: string;
  collections: SyncedCollection[];
};

export type ListCollectionItemsResponse = {
  workspaceId: string;
  collection: {
    id: string;
    name: string;
    slug: string;
  };
  items: Array<{
    id: string;
    data: Record<string, string | number | boolean | null>;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export type ListProjectsResponse = {
  workspaceId: string;
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type ListCollectionsResponse = {
  workspaceId: string;
  collections: Array<{
    id: string;
    name: string;
    slug: string;
    projectId: string;
    description: string | null;
    schema: CollectionField[];
  }>;
};

export type GenerateResponse = {
  clientPath: string;
  declarationsPath: string;
};

export type AddSkillResponse = {
  directoryPath: string;
  skillPath: string;
};

export type AskQuestion = (question: string) => Promise<string>;

export type ResolveConfigOptions = {
  requireApiKey?: boolean;
  requireProjectId?: boolean;
};

export type MiniConfig = {
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
  apiKey?: string;
  collectionId?: string;
  collectionsPath?: string;
  typesPath?: string;
  clientPath?: string;
  declarationsPath?: string;
};

export type ResolvedConfig = {
  configPath: string;
  baseUrl: string;
  workspaceId: string;
  projectId?: string;
  apiKey: string;
  collectionId?: string;
  collectionsPath: string;
  typesPath: string;
  clientPath: string;
  declarationsPath: string;
};

export type CommandOptions = {
  config?: string;
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
  apiKey?: string;
  collectionId?: string;
  collections?: string;
  itemsFile?: string;
  types?: string;
  client?: string;
  declarations?: string;
  page?: number;
  limit?: number;
  json?: boolean;
  verbose?: boolean;
};

export type CliEnv = {
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
  apiKey?: string;
};
