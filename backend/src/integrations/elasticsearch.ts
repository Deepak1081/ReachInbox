import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { EmailSearchParams } from '../types/index.js';

export const EMAIL_INDEX = 'reachinbox-emails';

class ElasticsearchService {
  private client: Client | null = null;
  private isConnected: boolean = false;

  constructor() {
    try {
      this.client = new Client({
        node: env.ELASTICSEARCH_NODE,
        maxRetries: 3,
        requestTimeout: 5000,
      });
    } catch (err: any) {
      logger.warn('Failed to initialize Elasticsearch client:', err.message);
    }
  }

  /**
   * Check connection and create index with mappings if not present
   */
  async initIndex(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const ping = await this.client.ping();
      if (!ping) {
        logger.warn('Elasticsearch ping returned false');
        this.isConnected = false;
        return false;
      }
      this.isConnected = true;
      logger.info(`Elasticsearch connected at ${env.ELASTICSEARCH_NODE}`);

      const exists = await this.client.indices.exists({ index: EMAIL_INDEX });

      if (!exists) {
        logger.info(`Creating Elasticsearch index: ${EMAIL_INDEX}`);
        await this.client.indices.create({
          index: EMAIL_INDEX,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: 'custom',
                    tokenizer: 'uax_url_email',
                    filter: ['lowercase'],
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                campaignId: { type: 'keyword' },
                userId: { type: 'keyword' },
                senderId: { type: 'keyword' },
                senderEmail: { type: 'keyword', fields: { analyzed: { type: 'text', analyzer: 'email_analyzer' } } },
                recipientEmail: { type: 'keyword', fields: { analyzed: { type: 'text', analyzer: 'email_analyzer' } } },
                subject: { type: 'text', analyzer: 'standard' },
                body: { type: 'text', analyzer: 'standard' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                createdAt: { type: 'date' },
                errorMessage: { type: 'text' },
                etherealUrl: { type: 'keyword' },
              },
            },
          },
        });
        logger.info(`Elasticsearch index ${EMAIL_INDEX} created with mapping`);
      }
      return true;
    } catch (err: any) {
      logger.warn(`Elasticsearch unavailable or index init failed: ${err.message}. Operations will proceed with DB fallback.`);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Index or update an email document
   */
  async indexEmail(doc: {
    id: string;
    campaignId: string;
    userId: string;
    senderId: string;
    senderEmail?: string;
    recipientEmail: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date | string;
    sentAt?: Date | string | null;
    createdAt: Date | string;
    errorMessage?: string | null;
    etherealUrl?: string | null;
  }): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      await this.client.index({
        index: EMAIL_INDEX,
        id: doc.id,
        body: {
          ...doc,
          scheduledAt: new Date(doc.scheduledAt).toISOString(),
          sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
          createdAt: new Date(doc.createdAt).toISOString(),
        },
      });
      logger.debug(`Email ${doc.id} indexed into Elasticsearch`);
    } catch (err: any) {
      logger.warn(`Failed to index email ${doc.id} into Elasticsearch:`, err.message);
    }
  }

  /**
   * Search emails using Elasticsearch full-text queries
   */
  async searchEmails(
    userId: string,
    params: EmailSearchParams
  ): Promise<{ hits: any[]; total: number } | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const from = (page - 1) * limit;

      const must: any[] = [{ term: { userId } }];
      const filter: any[] = [];

      if (params.status) {
        filter.push({ term: { status: params.status } });
      }

      if (params.campaignId) {
        filter.push({ term: { campaignId: params.campaignId } });
      }

      if (params.recipientEmail) {
        must.push({
          term: { recipientEmail: params.recipientEmail.toLowerCase() },
        });
      }

      if (params.senderEmail) {
        must.push({
          term: { senderEmail: params.senderEmail.toLowerCase() },
        });
      }

      if (params.startDate || params.endDate) {
        const range: any = {};
        if (params.startDate) range.gte = new Date(params.startDate).toISOString();
        if (params.endDate) range.lte = new Date(params.endDate).toISOString();
        filter.push({ range: { scheduledAt: range } });
      }

      // Full text query on subject, body, and email addresses
      if (params.q) {
        must.push({
          multi_match: {
            query: params.q,
            fields: ['subject^3', 'body', 'recipientEmail.analyzed^2', 'senderEmail.analyzed'],
            fuzziness: 'AUTO',
          },
        });
      }

      const response = await this.client.search({
        index: EMAIL_INDEX,
        from,
        size: limit,
        sort: [{ scheduledAt: { order: 'desc' } }],
        body: {
          query: {
            bool: {
              must,
              filter,
            },
          },
        },
      });

      const totalValue =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const hits = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
      }));

      return { hits, total: totalValue };
    } catch (err: any) {
      logger.warn('Elasticsearch search failed, falling back to database query:', err.message);
      return null;
    }
  }
}

export const elasticsearchService = new ElasticsearchService();
