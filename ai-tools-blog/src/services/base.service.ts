import { Model, Document, FilterQuery, UpdateQuery, QueryOptions, Types, ClientSession, SortOrder } from 'mongoose';
import { ApiError } from '../middleware/error.middleware';
import { PaginationParams } from '../interfaces/common';
import { logger } from '../utils/logger';

type MongooseQueryOptions<T> = QueryOptions<T> & { session?: ClientSession };

export class BaseService<T extends Document> {
  constructor(protected model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    try {
      const doc = new this.model(data);
      return await doc.save();
    } catch (error) {
      logger.error('Create operation failed:', error);
      throw error;
    }
  }

  async findById(id: string | Types.ObjectId, options: QueryOptions<T> = {}): Promise<T> {
    try {
      const doc = await this.model.findById(id, options);
      if (!doc) {
        throw new ApiError(404, 'NOT_FOUND', 'Document not found');
      }
      return doc;
    } catch (error) {
      logger.error('FindById operation failed:', error);
      throw error;
    }
  }

  async findOne(filter: FilterQuery<T>, options: QueryOptions<T> = {}): Promise<T | null> {
    try {
      return await this.model.findOne(filter, options);
    } catch (error) {
      logger.error('FindOne operation failed:', error);
      throw error;
    }
  }

  async find(
    filter: FilterQuery<T>,
    options: QueryOptions<T> = {},
    pagination?: PaginationParams,
    projection?: string
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    try {
      const { sort = 'createdAt', order = 'desc' as 'asc' | 'desc', limit = 10, page = 1 } = options || pagination || {};
      
      const skip = (page - 1) * limit;
      const sortQuery: { [key: string]: 'asc' | 'desc' } = { [sort]: order };

      const [data, total] = await Promise.all([
        this.model
          .find(filter, projection)
          .sort(sortQuery)
          .skip(skip)
          .limit(limit),
        this.model.countDocuments(filter),
      ]);

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Find operation failed:', error);
      throw error;
    }
  }

  async update(query: FilterQuery<T>, update: UpdateQuery<T>, options: MongooseQueryOptions<T> = { new: true }): Promise<T> {
    try {
      const doc = await this.model.findOneAndUpdate(query, update, options);
      if (!doc) {
        throw new ApiError(404, 'NOT_FOUND', 'Document not found');
      }
      return doc;
    } catch (error) {
      logger.error('Update operation failed:', error);
      throw error;
    }
  }

  async delete(id: string | Types.ObjectId): Promise<T> {
    try {
      const doc = await this.model.findByIdAndDelete(id);
      if (!doc) {
        throw new ApiError(404, 'NOT_FOUND', 'Document not found');
      }
      return doc;
    } catch (error) {
      logger.error('Delete operation failed:', error);
      throw error;
    }
  }

  async bulkCreate(data: Partial<T>[]): Promise<T[]> {
    try {
      return await this.model.insertMany(data);
    } catch (error) {
      logger.error('BulkCreate operation failed:', error);
      throw error;
    }
  }

  async bulkUpdate(filter: FilterQuery<T>, update: UpdateQuery<T>, options: MongooseQueryOptions<T> = { new: true }): Promise<{ modified: number }> {
    try {
      const result = await this.model.updateMany(filter, update, options);
      return { modified: result.modifiedCount };
    } catch (error) {
      logger.error('BulkUpdate operation failed:', error);
      throw error;
    }
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    try {
      return await this.model.exists(filter) !== null;
    } catch (error) {
      logger.error('Exists operation failed:', error);
      throw error;
    }
  }

  async count(filter: FilterQuery<T>): Promise<number> {
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      logger.error('Count operation failed:', error);
      throw error;
    }
  }
}
