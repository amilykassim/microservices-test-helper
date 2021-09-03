import { Injectable } from '@nestjs/common';
const asyncRedis = require('async-redis');
require('dotenv').config(); // setup the necessary kafka configs

@Injectable()
export class RedisHelper {
	private readonly client;

	constructor() {
		this.client = asyncRedis.createClient(`//${process.env.REDIS_URL}`);
		this.client.on('error', function (error) {
			console.error(error);
		});

		this.client.on('connect', function () {
			console.log('Connected to redis successfully');
		});
	}

	async set(key: string, value: any) {
		// The key should only last for 7 days (a week)
		await this.client.set(key, JSON.stringify(value), 'EX', 604800);
	}

	async get(key: string) {
		return JSON.parse(await this.client.get(key));
	}

	async getKeys(key: string) {
		return this.client.keys(`*${key}*`)
	}

	async unlink(key: string) {
		return this.client.unlink(key);
	}
}
