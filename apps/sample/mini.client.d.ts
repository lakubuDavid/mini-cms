export type CollectionSlug = MiniCmsCollectionSlug;

export type MiniCmsCollectionDefinition = {
  id: string | null;
  name: string;
  slug: string;
};

export type MiniCmsCollectionSlug = "testimonials" | "projects" | "partners" | "services" | "insights" | "team-members" | "metrics";

export type TestimonialsItem = {
  quote: string;
  name: string;
  role: string;
  featured: boolean;
};

export type ProjectsItem = {
  title: string;
  summary: string;
  serviceType: string;
  coverImage: string;
  publishedAt: string;
  featured: boolean;
};

export type PartnersItem = {
  name: string;
  logo: string;
  website: string;
  sortOrder: number;
  featured: boolean;
};

export type ServicesItem = {
  name: string;
  summary: string;
  priceLabel: string;
  icon: string;
  listImage: string;
  detailImagePrimary: string;
  detailImageSecondary: string;
  highlighted: boolean;
};

export type InsightsItem = {
  title: string;
  headline: string;
  author: string;
  excerpt: string;
  category: string;
  tags: string;
  coverImage: string;
  detailImage: string;
  publishedAt: string;
  featured: boolean;
};

export type TeamMembersItem = {
  name: string;
  role: string;
  bio: string;
  photo: string;
  sortOrder: number;
  isHiringCard: boolean;
};

export type MetricsItem = {
  label: string;
  value: number;
  icon: string;
  sortOrder: number;
  highlighted: boolean;
};

export type MiniCmsCollectionMap = {
  "testimonials": TestimonialsItem;
  "projects": ProjectsItem;
  "partners": PartnersItem;
  "services": ServicesItem;
  "insights": InsightsItem;
  "team-members": TeamMembersItem;
  "metrics": MetricsItem;
};

export type MiniCmsCollectionItem<T extends MiniCmsCollectionSlug> = MiniCmsCollectionMap[T];

export type MiniCmsClientConfig = {
  baseUrl?: string;
  workspaceId?: string;
  projectId?: string;
};

export type MiniCmsQueryFilters = Record<string, string | number | boolean | null | undefined>;

export type MiniCmsGetCollectionItemsOptions<TSlug extends MiniCmsCollectionSlug = MiniCmsCollectionSlug> = {
  collectionId?: string;
  workspaceId?: string;
  projectId?: string;
  page?: number;
  limit?: number;
  query?: string;
  filters?: MiniCmsQueryFilters;
  headers?: HeadersInit;
};

export type MiniCmsCollectionItemsResponse<TSlug extends MiniCmsCollectionSlug = MiniCmsCollectionSlug> = {
  workspace: { id: string; slug: string; name: string; };
  project: { id: string; slug: string; name: string; };
  collection: MiniCmsCollectionDefinition & { slug: TSlug; description?: string | null; schema?: Array<{ key: string; label: string; type: string; }>; };
  items: Array<MiniCmsCollectionItem<TSlug>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export declare const miniCmsConfig: {
  baseUrl: "http://localhost:3000";
  workspaceId: "jHlwWJEXcYz62SSJNfkoU1CthfV73agR";
  projectId: "gAGsED4dLQfUKIuZlaPfl";
};

export declare function getMiniCmsCollections(): MiniCmsCollectionDefinition[];

export declare function createMiniCmsClient(overrides?: MiniCmsClientConfig): {
  config: { baseUrl?: string; workspaceId?: string; projectId?: string; };
  collectionDefinitions: MiniCmsCollectionDefinition[];
  collections: {
  testimonials: { query(options?: MiniCmsGetCollectionItemsOptions<"testimonials">): Promise<MiniCmsCollectionItemsResponse<"testimonials">>; };
  projects: { query(options?: MiniCmsGetCollectionItemsOptions<"projects">): Promise<MiniCmsCollectionItemsResponse<"projects">>; };
  partners: { query(options?: MiniCmsGetCollectionItemsOptions<"partners">): Promise<MiniCmsCollectionItemsResponse<"partners">>; };
  services: { query(options?: MiniCmsGetCollectionItemsOptions<"services">): Promise<MiniCmsCollectionItemsResponse<"services">>; };
  insights: { query(options?: MiniCmsGetCollectionItemsOptions<"insights">): Promise<MiniCmsCollectionItemsResponse<"insights">>; };
  team_members: { query(options?: MiniCmsGetCollectionItemsOptions<"team-members">): Promise<MiniCmsCollectionItemsResponse<"team-members">>; };
  metrics: { query(options?: MiniCmsGetCollectionItemsOptions<"metrics">): Promise<MiniCmsCollectionItemsResponse<"metrics">>; };
  };
  getCollectionItems<TSlug extends MiniCmsCollectionSlug>(collectionSlug: TSlug, options?: MiniCmsGetCollectionItemsOptions<TSlug>): Promise<MiniCmsCollectionItemsResponse<TSlug>>;
};
