import { IBlog } from '../@types/models';
import { Blog } from '../models';
import { BaseService } from './base.service';
import { ApiError } from '../middleware/error.middleware';
import { ERROR_CODES, LANGUAGES } from '../constants';
import { logger } from '../utils/logger';
import { createRedisClient } from '../config/redis';
import { CACHE_TTL } from '../constants';

const redisClient = createRedisClient();

export class BlogService extends BaseService<IBlog> {
  constructor() {
    super(Blog);
  }

  async createBlogPost(blogData: Partial<IBlog>): Promise<IBlog> {
    try {
      // Generate SEO-friendly slug
      if (blogData.title) {
        blogData.slug = await this.generateUniqueSlug(blogData.title);
      }

      // Set default SEO metadata if not provided
      if (!blogData.seo) {
        blogData.seo = {
          metaTitle: blogData.title,
          metaDescription: blogData.excerpt?.substring(0, 160),
          keywords: [...(blogData.tags || []), ...(blogData.category || [])],
        };
      }

      const blog = await this.create(blogData);
      await this.clearBlogCache();
      return blog;
    } catch (error) {
      logger.error('Blog post creation failed:', error);
      throw error;
    }
  }

  async updateBlogPost(id: string, updateData: Partial<IBlog>): Promise<IBlog> {
    try {
      // If title is being updated, generate new slug
      if (updateData.title) {
        updateData.slug = await this.generateUniqueSlug(updateData.title);
      }

      // Update SEO metadata if content-related fields are updated
      if (updateData.title || updateData.excerpt || updateData.tags || updateData.category) {
        updateData.seo = {
          ...(await this.findById(id)).seo,
          ...(updateData.title && { metaTitle: updateData.title }),
          ...(updateData.excerpt && { metaDescription: updateData.excerpt.substring(0, 160) }),
          ...(updateData.tags || updateData.category) && {
            keywords: [
              ...(updateData.tags || []),
              ...(updateData.category || []),
            ],
          },
        };
      }

      const blog = await this.update(id, updateData);
      await this.clearBlogCache(id);
      return blog;
    } catch (error) {
      logger.error('Blog post update failed:', error);
      throw error;
    }
  }

  async addTranslation(
    id: string,
    language: string,
    translationData: {
      title: string;
      content: string;
      excerpt: string;
    }
  ): Promise<IBlog> {
    try {
      if (!Object.values(LANGUAGES).includes(language)) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid language code'
        );
      }

      const blog = await this.findById(id);
      
      if (blog.translations?.[language]) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Translation for this language already exists'
        );
      }

      blog.translations = {
        ...blog.translations,
        [language]: {
          title: translationData.title,
          content: translationData.content,
          excerpt: translationData.excerpt,
          slug: await this.generateUniqueSlug(translationData.title),
        },
      };

      await blog.save();
      await this.clearBlogCache(id);
      return blog;
    } catch (error) {
      logger.error('Translation addition failed:', error);
      throw error;
    }
  }

  async updateAnalytics(
    id: string,
    analyticsData: Partial<IBlog['analytics']>
  ): Promise<IBlog> {
    try {
      const blog = await this.findById(id);
      
      blog.analytics = {
        ...blog.analytics,
        ...analyticsData,
        lastUpdated: new Date(),
      };

      if (analyticsData.views) {
        blog.analytics.averageTimeOnPage =
          (blog.analytics.averageTimeOnPage * (blog.analytics.views - 1) +
            (analyticsData.averageTimeOnPage || 0)) /
          blog.analytics.views;
      }

      await blog.save();
      await this.clearBlogCache(id);
      return blog;
    } catch (error) {
      logger.error('Analytics update failed:', error);
      throw error;
    }
  }

  async findBySlug(slug: string, language?: string): Promise<IBlog> {
    try {
      const cacheKey = `blog:slug:${slug}:${language || 'default'}`;
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        logger.debug('Blog post found in cache');
        return JSON.parse(cached);
      }

      const blog = await this.findOne({ slug });
      if (!blog) {
        throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Blog post not found');
      }

      // If language is specified and translation exists, return translated version
      if (language && blog.translations?.[language]) {
        const translatedBlog = {
          ...blog.toObject(),
          title: blog.translations[language].title,
          content: blog.translations[language].content,
          excerpt: blog.translations[language].excerpt,
          slug: blog.translations[language].slug,
        };

        await redisClient.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(translatedBlog));
        return translatedBlog;
      }

      await redisClient.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(blog));
      return blog;
    } catch (error) {
      logger.error('Find by slug failed:', error);
      throw error;
    }
  }

  async searchBlogPosts(query: string): Promise<IBlog[]> {
    try {
      const cacheKey = `blog:search:${query}`;
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        logger.debug('Search results found in cache');
        return JSON.parse(cached);
      }

      const blogs = await this.model
        .find({
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { content: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } },
          ],
          status: 'published',
        })
        .sort({ 'analytics.views': -1 })
        .limit(10);

      await redisClient.setex(cacheKey, CACHE_TTL.SHORT, JSON.stringify(blogs));
      return blogs;
    } catch (error) {
      logger.error('Blog search failed:', error);
      throw error;
    }
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.exists({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async clearBlogCache(blogId?: string): Promise<void> {
    try {
      const patterns = ['blog:list:*'];
      
      if (blogId) {
        const blog = await this.findById(blogId);
        patterns.push(
          `blog:slug:${blog.slug}:*`,
          `blog:id:${blogId}`
        );
      }

      await Promise.all(
        patterns.map(pattern => redisClient.keys(pattern)
          .then(keys => keys.length > 0 ? redisClient.del(keys) : null)
        )
      );

      logger.debug('Blog cache cleared');
    } catch (error) {
      logger.error('Cache clearing failed:', error);
      throw error;
    }
  }
}
