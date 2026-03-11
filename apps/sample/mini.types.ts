/* eslint-disable */

export const workspaceId = "jHlwWJEXcYz62SSJNfkoU1CthfV73agR" as const;

export type CollectionSlug =
  | "metrics"
  | "team-members"
  | "insights"
  | "services"
  | "partners"
  | "projects"
  | "testimonials"
  | "stock"
  | "shops";

export type MetricsItem = {
  label: string;
  value: number;
  icon: string;
  sortOrder: number;
  highlighted: boolean;
};

export type TeamMembersItem = {
  name: string;
  role: string;
  bio: string;
  photo: string;
  sortOrder: number;
  isHiringCard: boolean;
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

export type PartnersItem = {
  name: string;
  logo: string;
  website: string;
  sortOrder: number;
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

export type TestimonialsItem = {
  quote: string;
  name: string;
  role: string;
  featured: boolean;
};

export type StockItem = {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  inStock: boolean;
};

export type ShopsItem = {
  name: string;
  city: string;
  website: string;
  openSince: string;
  featured: boolean;
};

export type CollectionMap = {
  "metrics": MetricsItem;
  "team-members": TeamMembersItem;
  "insights": InsightsItem;
  "services": ServicesItem;
  "partners": PartnersItem;
  "projects": ProjectsItem;
  "testimonials": TestimonialsItem;
  "stock": StockItem;
  "shops": ShopsItem;
};

export type CollectionItem<T extends CollectionSlug> = CollectionMap[T];

