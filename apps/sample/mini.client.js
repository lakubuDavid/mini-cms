/* eslint-disable */

/**
 * @typedef {object} MiniCmsCollectionDefinition
 * @property {string | null} id
 * @property {string} name
 * @property {string} slug
 */

/**
 * @typedef {object} TestimonialsItem
 * @property {string} quote
 * @property {string} name
 * @property {string} role
 * @property {boolean} featured
 */

/**
 * @typedef {object} ProjectsItem
 * @property {string} title
 * @property {string} summary
 * @property {string} serviceType
 * @property {string} coverImage
 * @property {string} publishedAt
 * @property {boolean} featured
 */

/**
 * @typedef {object} PartnersItem
 * @property {string} name
 * @property {string} logo
 * @property {string} website
 * @property {number} sortOrder
 * @property {boolean} featured
 */

/**
 * @typedef {object} ServicesItem
 * @property {string} name
 * @property {string} summary
 * @property {string} priceLabel
 * @property {string} icon
 * @property {string} listImage
 * @property {string} detailImagePrimary
 * @property {string} detailImageSecondary
 * @property {boolean} highlighted
 */

/**
 * @typedef {object} InsightsItem
 * @property {string} title
 * @property {string} headline
 * @property {string} author
 * @property {string} excerpt
 * @property {string} category
 * @property {string} tags
 * @property {string} coverImage
 * @property {string} detailImage
 * @property {string} publishedAt
 * @property {boolean} featured
 */

/**
 * @typedef {object} TeamMembersItem
 * @property {string} name
 * @property {string} role
 * @property {string} bio
 * @property {string} photo
 * @property {number} sortOrder
 * @property {boolean} isHiringCard
 */

/**
 * @typedef {object} MetricsItem
 * @property {string} label
 * @property {number} value
 * @property {string} icon
 * @property {number} sortOrder
 * @property {boolean} highlighted
 */

/** @typedef {"testimonials" | "projects" | "partners" | "services" | "insights" | "team-members" | "metrics"} MiniCmsCollectionSlug */

/**
 * @typedef {object} MiniCmsCollectionMap
 *   "testimonials": TestimonialsItem;
 *   "projects": ProjectsItem;
 *   "partners": PartnersItem;
 *   "services": ServicesItem;
 *   "insights": InsightsItem;
 *   "team-members": TeamMembersItem;
 *   "metrics": MetricsItem;
 */

/**
 * @typedef {object} MiniCmsClientConfig
 * @property {string} [baseUrl]
 * @property {string} [workspaceId]
 * @property {string} [projectId]
 */

/** @typedef {Record<string, string | number | boolean | null | undefined>} MiniCmsQueryFilters */

/**
 * @template {MiniCmsCollectionSlug} TSlug
 * @typedef {object} MiniCmsGetCollectionItemsOptions
 * @property {string} [collectionId]
 * @property {string} [workspaceId]
 * @property {string} [projectId]
 * @property {number} [page]
 * @property {number} [limit]
 * @property {string} [query]
 * @property {MiniCmsQueryFilters} [filters]
 * @property {HeadersInit} [headers]
 */

/**
 * @template {MiniCmsCollectionSlug} TSlug
 * @typedef {object} MiniCmsCollectionItemsResponse
 * @property {{ id: string, slug: string, name: string }} workspace
 * @property {{ id: string, slug: string, name: string }} project
 * @property {MiniCmsCollectionDefinition & { slug: TSlug, description?: string | null, schema?: Array<{ key: string, label: string, type: string }> }} collection
 * @property {Array<MiniCmsCollectionMap[TSlug]>} items
 * @property {{ page: number, limit: number, total: number, totalPages: number, hasMore: boolean }} pagination
 */

/** @type {MiniCmsClientConfig} */
const defaultConfig = {
  baseUrl: "http://localhost:3000",
  workspaceId: "jHlwWJEXcYz62SSJNfkoU1CthfV73agR",
  projectId: "gAGsED4dLQfUKIuZlaPfl",
};

/** @type {MiniCmsCollectionDefinition[]} */
const collections = 
[
  {
    "id": "IiEICe7xfDzQPpXkpANR3",
    "name": "Testimonials",
    "slug": "testimonials"
  },
  {
    "id": "_C3kI6OZHe4gE_1dvjD_B",
    "name": "Projects",
    "slug": "projects"
  },
  {
    "id": "dHn573KDnRLARfryfGtFP",
    "name": "Partners",
    "slug": "partners"
  },
  {
    "id": "Hf9ebDcno5bK5-oWfJGPG",
    "name": "Services",
    "slug": "services"
  },
  {
    "id": "Ict-_Lr72gnb64MWDpjm7",
    "name": "Insights",
    "slug": "insights"
  },
  {
    "id": "43D4oEVcV94e00U8FqjdN",
    "name": "Team Members",
    "slug": "team-members"
  },
  {
    "id": "CNUe-OvHS-v1ZR0gyrfxt",
    "name": "Metrics",
    "slug": "metrics"
  }
] ;

/** @returns {MiniCmsCollectionDefinition[]} */
export function getMiniCmsCollections() {
  return collections.slice();
}

/**
 * @param {MiniCmsClientConfig} [overrides={}]
 */
export function createMiniCmsClient(overrides = {}) {
  const runtimeConfig = { ...defaultConfig, ...overrides };
  const collections = {
    testimonials: { query: (options = {}) => getCollectionItems("testimonials", options) },
    projects: { query: (options = {}) => getCollectionItems("projects", options) },
    partners: { query: (options = {}) => getCollectionItems("partners", options) },
    services: { query: (options = {}) => getCollectionItems("services", options) },
    insights: { query: (options = {}) => getCollectionItems("insights", options) },
    team_members: { query: (options = {}) => getCollectionItems("team-members", options) },
    metrics: { query: (options = {}) => getCollectionItems("metrics", options) },
  };

  return {
    config: runtimeConfig,
    collectionDefinitions: getMiniCmsCollections(),
    collections,
    /**
     * @template {MiniCmsCollectionSlug} TSlug
     * @param {TSlug} collectionSlug
     * @param {MiniCmsGetCollectionItemsOptions<TSlug>} [options={}]
     * @returns {Promise<MiniCmsCollectionItemsResponse<TSlug>>}
     */
    getCollectionItems,
  };

  async function getCollectionItems(collectionSlug, options = {}) {
      const workspaceId = options?.workspaceId ?? runtimeConfig.workspaceId;
      const projectId = options?.projectId ?? runtimeConfig.projectId;

      if (!runtimeConfig.baseUrl || !workspaceId || !projectId || !collectionSlug) {
      throw new Error("baseUrl, workspaceId, projectId, and collectionSlug are required.");
      }

      const url = new URL('/api/collections/items', ensureTrailingSlash(runtimeConfig.baseUrl));
      url.searchParams.set('w', workspaceId);
      url.searchParams.set('p', projectId);

      if (options?.collectionId) {
        url.searchParams.set('collection_id', options.collectionId);
      } else {
        url.searchParams.set('collection_slug', collectionSlug);
      }

      if (options?.page != null) url.searchParams.set('page', String(options.page));
      if (options?.limit != null) url.searchParams.set('limit', String(options.limit));
      if (options?.query) url.searchParams.set('q', options.query);

      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value == null || value === '') continue;
          url.searchParams.set(`filter.${key}`, String(value));
        }
      }

      const response = await fetch(url.toString(), {
        headers: options?.headers ?? {},
      });

      if (!response.ok) {
        const message = await readMiniCmsError(response);
        throw new Error(message);
      }

      return response.json();
    }
}

/**
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function readMiniCmsError(response) {
  try {
    const body = await response.json();
    return body?.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

/**
 * @param {string} baseUrl
 * @returns {string}
 */
function ensureTrailingSlash(baseUrl) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export { defaultConfig as miniCmsConfig };
